import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  X, CheckCircle, MessageSquare, Users, Target, Crown, ShieldCheck, CreditCard,
  Image as ImageIcon, Loader2, CalendarClock, QrCode, Copy, Check, ArrowLeft
} from 'lucide-react';
import { formatFullDateTime } from '../../utils/time';

const PIX_POLL_INTERVAL_MS = 4000;
const PIX_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export const ProModal = () => {
  const { currentUser, isProModalOpen, setIsProModalOpen, setIsAuthModalOpen, refreshCurrentUser } = useAuth();
  const [view, setView] = useState('plans'); // 'plans' | 'pix-cpf' | 'pix-qr' | 'pix-paid'
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [cpf, setCpf] = useState('');
  const [pixData, setPixData] = useState(null); // { qrCode, qrCodeBase64 }
  const [pixCopied, setPixCopied] = useState(false);
  const expiryBeforePixRef = useRef(null);
  const pollTimerRef = useRef(null);

  const isPro = currentUser?.isPro;

  useEffect(() => {
    return () => clearInterval(pollTimerRef.current);
  }, []);

  const resetAndClose = () => {
    clearInterval(pollTimerRef.current);
    setView('plans');
    setErrorMsg('');
    setCpf('');
    setPixData(null);
    setIsProModalOpen(false);
  };

  const invokeAndReadError = async (fnName, body) => {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) {
      // supabase-js doesn't parse the function's JSON body on non-2xx
      // responses — `data` comes back null, the real message is only on
      // error.context (the raw Response), so read it from there.
      let message = 'Não foi possível processar o pagamento. Tente novamente.';
      try {
        const errBody = await error.context?.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // keep the generic message
      }
      return { data: null, message };
    }
    return { data, message: null };
  };

  // Card/boleto: redirect to Mercado Pago's hosted checkout. PRO is
  // activated by the mp-webhook Edge Function once payment is confirmed —
  // not from this click.
  const handleCardOrBoleto = async () => {
    if (!currentUser) {
      setIsProModalOpen(false);
      setIsAuthModalOpen(true);
      return;
    }
    setErrorMsg('');
    setIsProcessing(true);
    const { data, message } = await invokeAndReadError('mp-checkout');
    setIsProcessing(false);

    if (message || !data?.init_point) {
      setErrorMsg(message || 'Não foi possível iniciar o pagamento. Tente novamente.');
      return;
    }
    window.location.href = data.init_point;
  };

  const handlePixSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setIsProModalOpen(false);
      setIsAuthModalOpen(true);
      return;
    }
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) {
      setErrorMsg('Informe um CPF válido (11 dígitos).');
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);
    const { data, message } = await invokeAndReadError('mp-pix-payment', { cpf: digits });
    setIsProcessing(false);

    if (message || !data?.qr_code) {
      setErrorMsg(message || 'Não foi possível gerar o Pix. Tente novamente.');
      return;
    }

    setPixData({ qrCode: data.qr_code, qrCodeBase64: data.qr_code_base64 });
    expiryBeforePixRef.current = currentUser?.proExpiresAt || null;
    setView('pix-qr');
    startPollingForApproval();
  };

  // The webhook is the real source of truth for activating PRO; this
  // polling is purely so the modal can react and say "paid" without the
  // person having to manually reload the page.
  const startPollingForApproval = () => {
    const startedAt = Date.now();
    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - startedAt > PIX_POLL_TIMEOUT_MS) {
        clearInterval(pollTimerRef.current);
        return;
      }
      const { data } = await supabase.from('profiles').select('pro_expires_at').eq('id', currentUser.id).maybeSingle();
      const before = expiryBeforePixRef.current;
      if (data?.pro_expires_at && (!before || new Date(data.pro_expires_at) > new Date(before))) {
        clearInterval(pollTimerRef.current);
        await refreshCurrentUser();
        setView('pix-paid');
      }
    }, PIX_POLL_INTERVAL_MS);
  };

  const handleCopyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    } catch {
      // clipboard API unavailable; the code is still selectable by hand
    }
  };

  if (!isProModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[var(--c-surface)] border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-500/20 overflow-hidden p-6 my-8">

        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <button
          onClick={resetAndClose}
          className="absolute top-4 right-4 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {(view === 'pix-cpf' || view === 'pix-qr') && (
          <button
            onClick={() => { clearInterval(pollTimerRef.current); setView('plans'); setErrorMsg(''); }}
            className="absolute top-4 left-4 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-xl shadow-amber-500/30 mb-3 transform hover:scale-105 transition">
            <Crown className="w-7 h-7 text-black fill-current" />
          </div>
          <h2 className="font-display text-2xl font-semibold italic text-[var(--c-text)] tracking-tight flex items-center justify-center gap-2">
            LoveVibe <span className="text-amber-400">VIP PRÓ</span>
          </h2>
          <p className="text-xs text-[var(--c-pro-text)] mt-1">Conexões sem limites e recursos exclusivos para solteiros e casais</p>
        </div>

        {view === 'pix-cpf' ? (
          <form onSubmit={handlePixSubmit} className="space-y-3">
            <div className="p-4 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-2xl space-y-3">
              <p className="text-xs text-[var(--c-text-secondary)]">
                O Pix exige o CPF de quem está pagando (exigência do Banco Central, não do LoveVibe).
              </p>
              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="Somente números"
                  className="w-full bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl py-2.5 px-3 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
            {errorMsg && <p className="text-[11px] text-center text-red-400 font-medium">{errorMsg}</p>}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs rounded-xl shadow-xl shadow-amber-500/30 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              <span>{isProcessing ? 'Gerando Pix...' : 'Gerar QR Code Pix'}</span>
            </button>
          </form>
        ) : view === 'pix-qr' ? (
          <div className="space-y-3 text-center">
            <p className="text-xs text-[var(--c-text-secondary)]">Escaneie o QR Code no app do seu banco ou copie o código abaixo.</p>
            {pixData?.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code Pix"
                className="w-48 h-48 mx-auto rounded-xl border border-[var(--c-border)] bg-white p-2"
              />
            )}
            <button
              type="button"
              onClick={handleCopyPixCode}
              className="w-full py-2.5 bg-[var(--c-surface-3)] hover:bg-[var(--c-overlay-10)] border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
            >
              {pixCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {pixCopied ? 'Código copiado!' : 'Copiar código Pix (copia e cola)'}
            </button>
            <p className="text-[10px] text-[var(--c-text-muted)] flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Aguardando confirmação do pagamento...
            </p>
          </div>
        ) : view === 'pix-paid' ? (
          <div className="text-center space-y-3 py-4">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-[var(--c-text)]">Pagamento confirmado! Sua conta já é VIP PRÓ.</p>
            <button
              onClick={resetAndClose}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-xs rounded-xl transition"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Active Pro Status Banner — 1 month from payment, manual renewal only */}
            {isPro ? (
              <div className="p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50 rounded-2xl text-center space-y-2 mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-black text-xs font-extrabold rounded-full shadow-md">
                  <ShieldCheck className="w-4 h-4 fill-black" /> Assinatura VIP PRÓ Ativa
                </div>
                {currentUser?.proExpiresAt && (
                  <p className="text-xs text-[var(--c-text)] font-semibold flex items-center justify-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                    Válido até {formatFullDateTime(currentUser.proExpiresAt)}
                  </p>
                )}
                <p className="text-[10px] text-[var(--c-pro-text)]">
                  * A renovação NÃO é automática. Depois dessa data e hora, para continuar com os benefícios PRÓ você precisa assinar novamente.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-r from-amber-950/40 via-yellow-950/40 to-amber-950/40 border border-amber-500/30 rounded-2xl text-center mb-4 space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold">Acesso PRÓ mensal</span>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-black text-[var(--c-text)]">R$ 29,90</span>
                  <span className="text-xs text-[var(--c-pro-text)]">/ mês</span>
                </div>
                <p className="text-[10px] text-[var(--c-text-muted)]">
                  Acesso imediato assim que o pagamento for aprovado, válido até o mesmo dia e horário do mês seguinte. Sem renovação automática.
                </p>
              </div>
            )}

            {/* Benefits list */}
            <div className="space-y-3 bg-[var(--c-surface-3)] p-4 rounded-2xl border border-amber-500/20 mb-6">
              {[
                {
                  title: 'Envie Mensagens no Chat Direto',
                  desc: 'Apenas membros PRÓ podem enviar mensagens diretas para qualquer pessoa da rede.',
                  icon: MessageSquare
                },
                {
                  title: 'Envie Fotos no Chat Privado',
                  desc: 'Membros PRÓ podem compartilhar fotos diretamente nas conversas privadas, não só texto.',
                  icon: ImageIcon
                },
                {
                  title: 'Salas de Grupos Exclusivas para Membros PRÓ',
                  desc: 'Visualize e participe de bate-papos coletivos para casais, enofilia, viagens e festas.',
                  icon: Users
                },
                {
                  title: 'Recomendações de Perfis Personalizadas',
                  desc: 'Suas preferências de idade, sexo e localização priorizam o que aparece no seu feed.',
                  icon: Target
                },
                {
                  title: 'Selo Dourado de Destaque no Feed',
                  desc: 'Ganhe destaque oficial PRÓ em suas publicações e no chat.',
                  icon: Crown
                }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mt-0.5 flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--c-text)] flex items-center gap-1">
                        {item.title} <CheckCircle className="w-3 h-3 text-emerald-400" />
                      </h4>
                      <p className="text-[10px] text-[var(--c-text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Official Purchase Action — pick a payment method */}
            {!isPro ? (
              <div className="space-y-2">
                {errorMsg && (
                  <p className="text-[11px] text-center text-red-400 font-medium">{errorMsg}</p>
                )}
                <p className="text-[10px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider text-center">
                  Assinar Plano VIP PRÓ (R$ 29,90) — Escolha a forma de pagamento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCardOrBoleto}
                    disabled={isProcessing}
                    className="py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs rounded-xl shadow-xl shadow-amber-500/30 transition transform hover:scale-102 active:scale-98 flex flex-col items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    <span>Cartão ou Boleto</span>
                  </button>
                  <button
                    onClick={() => { setErrorMsg(''); setView('pix-cpf'); }}
                    disabled={isProcessing}
                    className="py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs rounded-xl shadow-xl shadow-amber-500/30 transition transform hover:scale-102 active:scale-98 flex flex-col items-center justify-center gap-1 disabled:opacity-60"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Pix</span>
                  </button>
                </div>
                <p className="text-[10px] text-center text-[var(--c-text-faint)]">
                  🔒 Pagamento seguro via Mercado Pago. Renovação manual — sem cobrança recorrente automática.
                </p>
              </div>
            ) : (
              <button
                onClick={resetAndClose}
                className="w-full py-3 bg-[var(--c-overlay-10)] hover:bg-[var(--c-overlay-20)] text-[var(--c-text)] font-bold text-xs rounded-xl transition"
              >
                Fechar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
