import React from 'react';
import { LifeBuoy } from 'lucide-react';

// TODO: point this at a real, monitored support inbox before launch.
const SUPPORT_EMAIL = 'suporte@lovevibe.com.br';

export const SupportButton = ({ className = '', onClick }) => (
  <a
    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Suporte LoveVibe')}`}
    onClick={onClick}
    className={
      className ||
      'inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-rose-400 transition'
    }
  >
    <LifeBuoy className="w-3.5 h-3.5" /> Suporte
  </a>
);
