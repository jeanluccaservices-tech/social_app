import { useEffect, useRef } from 'react';

// This SPA has no router, so there's normally no history entry for the
// phone's back button to consume when a full-screen modal is open — it
// just exits the app/browser instead of closing the modal. Pushing one
// history entry while the modal is open gives the back button (and the
// browser's own back button) something to "undo" first.
export const useBackButtonClose = (isOpen, onClose) => {
  const pushedRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modal: true }, '');
    pushedRef.current = true;

    const handlePopState = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Closed some other way (X button, submit, ...) while our pushed
      // entry is still current — consume it so the next real back press
      // doesn't land on a stale entry that no longer closes anything.
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen]);
};
