import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

const ToastContext = createContext();

const ICONS = {
  success: { Icon: CheckCircle, className: 'text-emerald-400' },
  error: { Icon: XCircle, className: 'text-red-400' }
};

let nextId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => dismissToast(id), 3500);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 px-4 w-full max-w-sm pointer-events-none"
      >
        {toasts.map(t => {
          const { Icon, className } = ICONS[t.type] || ICONS.success;
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto w-full flex items-center gap-2.5 py-3 px-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl animate-toast-in"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${className}`} />
              <p className="flex-1 text-xs font-semibold text-[var(--c-text)]">{t.message}</p>
              <button
                onClick={() => dismissToast(t.id)}
                className="flex-shrink-0 text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
