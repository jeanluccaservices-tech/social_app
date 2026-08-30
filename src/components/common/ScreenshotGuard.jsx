import { useEffect } from 'react';
import { useToast } from '../../context/ToastContext';

// No browser API can block a screenshot or screen recording — the OS
// captures the screen below the page. This only reacts to the PrintScreen
// key (desktop browsers surface it as a keyup, never keydown) to remind the
// person it's against the Terms of Use; real enforcement is contractual,
// not technical.
export const ScreenshotGuard = () => {
  const { showToast } = useToast();

  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen') {
        showToast('Capturas de tela são proibidas pelos Termos de Uso do LoveVibe.', 'error');
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [showToast]);

  return null;
};
