import React from 'react';
import { User, Users } from 'lucide-react';

// Renders the user's own photo when they have one, or a neutral silhouette
// placeholder — never a stock stand-in photo — until they upload one.
export const Avatar = ({ src, alt, isCouple = false, className = '', ...rest }) => {
  if (src) {
    return <img src={src} alt={alt} className={className} {...rest} />;
  }
  const Icon = isCouple ? Users : User;
  return (
    <div
      role="img"
      aria-label={alt}
      className={`${className} flex items-center justify-center bg-[var(--c-surface-3)] text-[var(--c-text-faint)]`}
    >
      <Icon className="w-1/2 h-1/2" strokeWidth={1.5} />
    </div>
  );
};
