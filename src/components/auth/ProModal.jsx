import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  X, CheckCircle, MessageSquare, Users, Target, Crown, ShieldCheck, CreditCard,
  Image as ImageIcon, Loader2, CalendarClock, TrendingUp
} from 'lucide-react';
import { formatFullDateTime } from '../../utils/time';
import { SupportButton } from '../common/SupportButton';

export const ProModal = () => {
  const { currentUser, isProModalOpen, setIsProModalOpen, setIsAuthModalOpen, cancelProSubscription } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');

  const isPro = currentUser?.isPro;

  const resetAndClose = () => {
    setErrorMsg('');
    setShowCancelConfirm(false);
    setCancelMsg('');
    setIsProModalOpen(false);
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setCancelMsg('');
    const { success, message } = await cancelProSubscription();
    setIsCancelling(false);
    if (!success) {
      setCancelMsg(message);
      return;
    }
    setShowCancelConfirm(false);
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

  // Single button for every payment method: redirects to Stripe's hosted
  // checkout, which shows whatever methods (card, boleto, Pix, ...) are
  // enabled on the Stripe account's payment settings — no per-method code
  // needed here. PRO is activated by the stripe-webhook Edge Function once
  // payment is confirmed, not from this click.
  const handleSubscribe = async () => {
    if (!currentUser) {
      setIsProModalOpen(false);
      setIsAuthModalOpen(true);
      return;
    }
    setErrorMsg('');
    setIsProcessing(true);
    const { data, message } = await invokeAndReadError('stripe-checkout');
    setIsProcessing(false);

    if (message || !data?.url) {
      setErrorMsg(message || 'Não foi possível iniciar o pagamento. Tente novamente.');
      return;
    }
    window.location.href = data.url;
  };

  if (!isProModalOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--c-surface)] border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-500/20 overflow-hidden p-6 my-auto">

        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <SupportButton className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-rose-400 transition" />

        <button
          onClick={resetAndClose}
          className="absolute top-4 right-4 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-xl shadow-amber-500/30 mb-3 transform hover:scale-105 transition">
            <Crown className="w-7 h-7 text-black fill-current" />
          </div>
          <h2 className="font-display text-2xl font-semibold italic text-[var(--c-text)] tracking-tight flex items-center justify-center gap-2">
            LoveVibe <span className="text-amber-400">VIP</span>
          </h2>
          <p className="text-xs text-[var(--c-pro-text)] mt-1">Conexões sem limites e recursos exclusivos para solteiros e casais</p>
        </div>

        {/* Active Pro Status Banner — 1 month from payment, manual renewal only */}
        {isPro ? (
          <div className="p-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/50 rounded-2xl text-center space-y-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-black text-xs font-extrabold rounded-full shadow-md">
              <ShieldCheck className="w-4 h-4 fill-black" /> Assinatura VIP Ativa
            </div>
            {currentUser?.proExpiresAt && (
              <p className="text-xs text-[var(--c-text)] font-semibold flex items-center justify-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                Válido até {formatFullDateTime(currentUser.proExpiresAt)}
              </p>
            )}
            <p className="text-[10px] text-[var(--c-pro-text)]">
              * A renovação NÃO é automática. Depois dessa data e hora, para continuar com os benefícios VIP você precisa assinar novamente.
            </p>

            <button
              onClick={() => { setCancelMsg(''); setShowCancelConfirm(true); }}
              className="text-[9px] text-[var(--c-text-faint)] underline decoration-dotted hover:text-[var(--c-text-muted)] transition"
            >
              Cancelar assinatura
            </button>
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-r from-amber-950/40 via-yellow-950/40 to-amber-950/40 border border-amber-500/30 rounded-2xl text-center mb-4 space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold">Acesso VIP mensal</span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-black text-[var(--c-text)]">R$ 24,90</span>
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
              desc: 'Apenas membros VIP podem enviar mensagens diretas para qualquer pessoa da rede.',
              icon: MessageSquare
            },
            {
              title: 'Envie Fotos no Chat Privado',
              desc: 'Membros VIP podem compartilhar fotos diretamente nas conversas privadas, não só texto.',
              icon: ImageIcon
            },
            {
              title: 'Salas de Grupos Exclusivas para Membros VIP',
              desc: 'Visualize e participe de bate-papos coletivos para casais, enofilia, viagens e festas.',
              icon: Users
            },
            {
              title: 'Aba "Em Alta" Exclusiva',
              desc: 'Veja as publicações com mais curtidas e comentários de toda a rede, só para membros VIP.',
              icon: TrendingUp
            },
            {
              title: 'Recomendações de Perfis Personalizadas',
              desc: 'Suas preferências de idade, sexo e localização priorizam o que aparece no seu feed.',
              icon: Target
            },
            {
              title: 'Selo Dourado de Destaque no Feed',
              desc: 'Ganhe destaque oficial VIP em suas publicações e no chat.',
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

        {/* Official Purchase Action */}
        {!isPro ? (
          <div className="space-y-2">
            {errorMsg && (
              <p className="text-[11px] text-center text-red-400 font-medium">{errorMsg}</p>
            )}
            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs rounded-xl shadow-xl shadow-amber-500/30 transition transform hover:scale-102 active:scale-98 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              <span>{isProcessing ? 'Abrindo pagamento...' : 'Assinar Plano VIP (R$ 24,90)'}</span>
            </button>
            <p className="text-[10px] text-center text-[var(--c-text-faint)]">
              🔒 Pagamento seguro via Stripe (cartão, boleto ou Pix). Renovação manual — sem cobrança recorrente automática.
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
      </div>
    </div>

    {showCancelConfirm && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <div className="relative w-full max-w-sm bg-[var(--c-surface)] border border-red-500/40 rounded-3xl shadow-2xl shadow-red-950/40 p-6 space-y-4">
          <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-red-400" /> Cancelar assinatura VIP?
          </h3>
          <p className="text-xs text-[var(--c-text-secondary)] leading-relaxed">
            Ao confirmar, você perde imediatamente o acesso a todos os benefícios VIP: chat direto, fotos no chat privado, salas de grupo exclusivas, aba "Em Alta", recomendações personalizadas e o selo dourado. Você recebe o reembolso integral do valor pago, já que ainda está dentro do prazo de 7 dias.
          </p>
          {cancelMsg && <p className="text-xs text-red-400 font-medium">{cancelMsg}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setShowCancelConfirm(false)}
              disabled={isCancelling}
              className="flex-1 py-2.5 bg-[var(--c-overlay-10)] hover:bg-[var(--c-overlay-20)] text-[var(--c-text)] font-bold text-xs rounded-xl transition disabled:opacity-60"
            >
              Manter assinatura
            </button>
            <button
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isCancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isCancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
