import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import { ShieldCheck, Users, Sparkles, Flag, Ban, RotateCcw, Trash2, Loader2, Search } from 'lucide-react';

// Everything here is convenience UI only — the tab itself is hidden from
// non-admins (App.jsx/Sidebar check currentUser via the isAdmin flag), but
// every actual read/write below is independently gated server-side
// (is_admin(), checked against the caller's own auth.uid()): the RLS
// policies on post_reports/deleted_accounts, and inside the
// admin-ban-user/admin-unban-user/delete-post Edge Functions. A tampered
// client can't get past any of that.
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="p-3.5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl">
    <Icon className={`w-4 h-4 mb-1.5 ${color}`} />
    <p className="text-xl font-black text-[var(--c-text)]">{value}</p>
    <p className="text-[10px] text-[var(--c-text-muted)] font-semibold">{label}</p>
  </div>
);

export const AdminPanel = () => {
  const { users, fetchUsers } = useAuth();
  const { showToast } = useToast();

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    const { data } = await supabase
      .from('post_reports')
      .select(`
        id, reason, details, created_at, resolved_at,
        reporter:profiles!post_reports_reporter_id_fkey ( id, name, username ),
        post:posts!post_reports_post_id_fkey ( id, content, media_url, deleted_at, author:profiles!posts_user_id_fkey ( id, name, username ) )
      `)
      .order('created_at', { ascending: false });
    setReports(data || []);
    setReportsLoading(false);
  }, []);

  const fetchDeletedCount = useCallback(async () => {
    const { count } = await supabase.from('deleted_accounts').select('id', { count: 'exact', head: true });
    setDeletedCount(count || 0);
  }, []);

  useEffect(() => {
    fetchReports();
    fetchDeletedCount();
  }, [fetchReports, fetchDeletedCount]);

  const invokeAdmin = async (fnName, body) => {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) {
      let message = 'Não foi possível concluir a ação.';
      try {
        const errBody = await error.context?.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // keep the generic message
      }
      return { success: false, message };
    }
    return { success: true, data };
  };

  const handleBan = async (userId, name) => {
    if (!window.confirm(`Banir ${name}? A conta perde acesso imediatamente.`)) return;
    setBusyId(userId);
    const res = await invokeAdmin('admin-ban-user', { target_user_id: userId });
    setBusyId(null);
    showToast(res.success ? 'Usuário banido.' : res.message, res.success ? 'success' : 'error');
    if (res.success) fetchUsers();
  };

  const handleUnban = async (userId) => {
    setBusyId(userId);
    const res = await invokeAdmin('admin-unban-user', { target_user_id: userId });
    setBusyId(null);
    showToast(res.success ? 'Usuário desbanido.' : res.message, res.success ? 'success' : 'error');
    if (res.success) fetchUsers();
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Apagar esta publicação?')) return;
    setBusyId(postId);
    const res = await invokeAdmin('delete-post', { post_id: postId });
    setBusyId(null);
    showToast(res.success ? 'Publicação apagada.' : res.message, res.success ? 'success' : 'error');
    if (res.success) fetchReports();
  };

  const handleResolveReport = async (reportId, ignore) => {
    setBusyId(reportId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('post_reports')
      .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', reportId);
    setBusyId(null);
    if (error) {
      showToast('Não foi possível atualizar a denúncia.', 'error');
      return;
    }
    showToast(ignore ? 'Denúncia ignorada.' : 'Denúncia marcada como resolvida.', 'success');
    fetchReports();
  };

  const totalUsers = users.length;
  const proCount = users.filter((u) => u.isPro).length;
  const bannedCount = users.filter((u) => u.bannedUntil && new Date(u.bannedUntil) > new Date()).length;
  const pendingReportsCount = reports.filter((r) => !r.resolved_at).length;
  const visibleReports = reports.filter((r) => showResolved || !r.resolved_at);
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-rose-500" />
        <h2 className="text-lg font-bold text-[var(--c-text)]">Painel Admin</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Usuários ativos" value={totalUsers} color="text-rose-400" />
        <StatCard icon={Sparkles} label="VIP" value={proCount} color="text-amber-400" />
        <StatCard icon={Ban} label="Banidos" value={bannedCount} color="text-red-400" />
        <StatCard icon={Flag} label="Denúncias pendentes" value={pendingReportsCount} color="text-orange-400" />
        <StatCard icon={Trash2} label="Contas excluídas" value={deletedCount} color="text-[var(--c-text-muted)]" />
      </div>

      {/* Reports */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-1.5">
            <Flag className="w-4 h-4 text-orange-400" /> Denúncias
          </h3>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--c-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="accent-rose-600"
            />
            Mostrar resolvidas
          </label>
        </div>

        {reportsLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--c-text-muted)]" />
          </div>
        ) : visibleReports.length === 0 ? (
          <p className="text-xs text-[var(--c-text-muted)] text-center py-6">Nenhuma denúncia por aqui.</p>
        ) : (
          <div className="space-y-2">
            {visibleReports.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-2xl border space-y-2 ${
                  r.resolved_at ? 'border-[var(--c-border)] opacity-60' : 'border-orange-500/30 bg-orange-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[var(--c-text)]">{r.reason}</p>
                    {r.details && <p className="text-[11px] text-[var(--c-text-muted)] mt-0.5">{r.details}</p>}
                  </div>
                  {r.resolved_at && (
                    <span className="text-[9px] font-bold text-emerald-400 flex-shrink-0">RESOLVIDA</span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--c-text-faint)]">
                  Denunciado por @{r.reporter?.username || '—'} · Autor: @{r.post?.author?.username || '—'}
                </p>
                {r.post?.content && (
                  <p className="text-[11px] text-[var(--c-text-dim)] bg-[var(--c-surface-3)] p-2 rounded-lg line-clamp-3">
                    {r.post.content}
                  </p>
                )}
                {!r.resolved_at && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {r.post && !r.post.deleted_at && (
                      <button
                        onClick={() => handleDeletePost(r.post.id)}
                        disabled={busyId === r.post.id}
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg transition disabled:opacity-60"
                      >
                        Apagar post
                      </button>
                    )}
                    {r.post?.author && (
                      <button
                        onClick={() => handleBan(r.post.author.id, r.post.author.name)}
                        disabled={busyId === r.post.author.id}
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg transition disabled:opacity-60"
                      >
                        Banir autor
                      </button>
                    )}
                    <button
                      onClick={() => handleResolveReport(r.id, false)}
                      disabled={busyId === r.id}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg transition disabled:opacity-60"
                    >
                      Marcar resolvida
                    </button>
                    <button
                      onClick={() => handleResolveReport(r.id, true)}
                      disabled={busyId === r.id}
                      className="px-2.5 py-1 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-[var(--c-text-muted)] text-[10px] font-bold rounded-lg transition disabled:opacity-60"
                    >
                      Ignorar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-1.5">
          <Users className="w-4 h-4 text-rose-400" /> Usuários
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--c-text-muted)]" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Buscar por nome ou @usuário..."
            className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 pl-9 pr-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
          />
        </div>
        <div className="max-h-96 overflow-y-auto space-y-1.5">
          {filteredUsers.slice(0, 50).map((u) => {
            const banned = u.bannedUntil && new Date(u.bannedUntil) > new Date();
            return (
              <div key={u.id} className="flex items-center justify-between gap-2 p-2 bg-[var(--c-surface-3)] rounded-xl">
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-[var(--c-text)] truncate flex items-center gap-1">
                    {u.name} {u.isPro && <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                  </p>
                  <p className="text-[10px] text-[var(--c-text-muted)] truncate">
                    @{u.username}
                    {banned && <span className="text-red-400 font-bold"> · BANIDO</span>}
                  </p>
                </div>
                {banned ? (
                  <button
                    onClick={() => handleUnban(u.id)}
                    disabled={busyId === u.id}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg transition flex items-center gap-1 disabled:opacity-60"
                  >
                    <RotateCcw className="w-3 h-3" /> Desbanir
                  </button>
                ) : (
                  <button
                    onClick={() => handleBan(u.id, u.name)}
                    disabled={busyId === u.id}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg transition flex items-center gap-1 disabled:opacity-60"
                  >
                    <Ban className="w-3 h-3" /> Banir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
