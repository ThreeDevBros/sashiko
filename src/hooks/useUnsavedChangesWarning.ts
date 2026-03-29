import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook that warns users when they try to leave a page with unsaved changes.
 * Intercepts: sidebar links, browser back, tab close/refresh.
 */
export const useUnsavedChangesWarning = (isDirty: boolean) => {
  const [showDialog, setShowDialog] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Handle browser tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept all in-app link clicks
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;
      // Don't intercept navigation to the current page
      if (href === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      pendingNavRef.current = href;
      setShowDialog(true);
    };

    // Use capture phase to intercept before react-router
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty]);

  // Handle browser back button
  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState(null, '', window.location.href);
    const handler = () => {
      if (isDirtyRef.current) {
        window.history.pushState(null, '', window.location.href);
        pendingNavRef.current = '__back__';
        setShowDialog(true);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    setShowDialog(false);
    const target = pendingNavRef.current;
    pendingNavRef.current = null;
    // Temporarily clear dirty so our interceptor doesn't re-trigger
    isDirtyRef.current = false;
    if (target === '__back__') {
      navigate(-1 as any);
    } else if (target) {
      navigate(target);
    }
  }, [navigate]);

  const cancelLeave = useCallback(() => {
    setShowDialog(false);
    pendingNavRef.current = null;
  }, []);

  return { showDialog, confirmLeave, cancelLeave };
};
