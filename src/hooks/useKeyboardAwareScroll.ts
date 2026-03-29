import { useCallback, useRef, useState } from 'react';

/**
 * Hook that ensures a focused input stays visible when the mobile keyboard opens.
 * Uses scrollIntoView inside the drawer's scroll container instead of fixed positioning.
 */
export function useKeyboardAwareScroll<T extends HTMLElement>() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<T>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const scrollTimerRef = useRef<number | null>(null);

  const isMobile = () => window.innerWidth < 768;

  const scrollIntoVisible = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Scroll within the nearest scrollable parent (the drawer's overflow container)
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const onFocus = useCallback(() => {
    if (!isMobile()) return;
    setIsKeyboardOpen(true);

    // Wait for keyboard to finish animating open, then scroll
    scrollTimerRef.current = window.setTimeout(() => {
      scrollIntoVisible();
    }, 400);

    // Also re-scroll on viewport resize (keyboard height changes)
    const vv = window.visualViewport;
    if (vv) {
      const handleResize = () => {
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = window.setTimeout(scrollIntoVisible, 100);
      };
      vv.addEventListener('resize', handleResize);
      // Store cleanup ref
      (wrapperRef as any)._cleanupResize = () => {
        vv.removeEventListener('resize', handleResize);
      };
    }
  }, [scrollIntoVisible]);

  const onBlur = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
    setIsKeyboardOpen(false);

    // Clean up viewport listener
    const cleanup = (wrapperRef as any)._cleanupResize;
    if (cleanup) {
      cleanup();
      (wrapperRef as any)._cleanupResize = null;
    }
  }, []);

  return { wrapperRef, ref: inputRef, onFocus, onBlur, isKeyboardOpen };
}
