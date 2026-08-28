import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Heart, LogIn, MessageSquare, Flame, ShieldCheck, Sparkles, HeartHandshake
} from 'lucide-react';

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Chat Privado',
    desc: 'Converse diretamente com quem você escolher, com fotos e total privacidade.'
  },
  {
    icon: Flame,
    title: 'Salas de Grupo VIP',
    desc: 'Bate-papos coletivos exclusivos para casais, solteiros e temas variados.'
  },
  {
    icon: Heart,
    title: 'Match por Swipe',
    desc: 'Curta perfis e conecte-se com pessoas compatíveis com o seu perfil.'
  },
  {
    icon: HeartHandshake,
    title: 'Casais Bem-vindos',
    desc: 'Um espaço pensado também para casais em busca de novas conexões.'
  },
  {
    icon: ShieldCheck,
    title: 'Ambiente Seguro e Discreto',
    desc: 'Verificação de idade, perfis reais e sua privacidade sempre em primeiro lugar.'
  },
  {
    icon: Sparkles,
    title: 'Recursos PRÓ Exclusivos',
    desc: 'Destaque seu perfil, participe das salas VIP e desbloqueie recursos premium.'
  }
];

// Shown instead of the app whenever there's no session — profiles, posts
// and everyone's photos are private to logged-in members, so a visitor
// gets this sales pitch instead of a peek at the feed. Clicking through
// is what opens AuthModal; it no longer opens itself automatically.
export const LoginGate = () => {
  const { setIsAuthModalOpen, setIsProModalOpen } = useAuth();

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-4xl flex flex-col items-center text-center gap-6">
        {/* Brand */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
          <Heart className="w-8 h-8 text-white fill-current animate-pulse" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold italic text-[var(--c-text)] tracking-tight">
          Love<span className="text-rose-500">Vibe</span>
        </h1>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> A rede social mais nova para adultos
        </span>

        {/* Hero copy */}
        <div className="space-y-3 max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--c-text)] leading-snug">
            Conexões reais, conversas sem filtro e experiências que você não encontra em qualquer app.
          </h2>
          <p className="text-sm sm:text-base text-[var(--c-accent)] leading-relaxed">
            Contamos com serviços diferenciados: chat privado, salas de grupo exclusivas, match por swipe
            e um feed pensado para solteiros e casais. Tudo em um ambiente seguro, discreto e feito para maiores de 18 anos.
          </p>
        </div>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-7 py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Entrar / Cadastrar
          </button>
          <button
            onClick={() => setIsProModalOpen(true)}
            className="px-6 py-3 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] border border-amber-500/40 text-[var(--c-pro-text)] font-bold text-xs rounded-2xl transition flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" /> Conheça o plano PRÓ
          </button>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-8 w-full text-left">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl shadow-lg space-y-2.5"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[var(--c-text)]">{title}</h3>
              <p className="text-xs text-[var(--c-text-muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-[var(--c-text-faint)] pt-6">
          Conteúdo exclusivo para maiores de 18 anos. Ao se cadastrar, você concorda com nossos Termos de Uso.
        </p>
      </div>
    </div>
  );
};
