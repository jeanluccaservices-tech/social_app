import { useRef, useState, useCallback } from 'react';

// Native touch-based pull-to-refresh — no library, just a threshold on how
// far the user drags down while already scrolled to the very top of
// `containerRef`. Returns a pull distance (for the visual indicator) and
// touch handlers to spread onto that same scrollable container.
export const usePullToRefresh = (containerRef, onRefresh, threshold = 70) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (refreshing || (containerRef.current?.scrollTop ?? 0) > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
  }, [containerRef, refreshing]);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPullDistance(Math.min(delta, threshold * 1.5));
  }, [threshold]);

  const onTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
    startY.current = null;
  }, [pullDistance, threshold, onRefresh]);

  return { pullDistance, refreshing, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
};
