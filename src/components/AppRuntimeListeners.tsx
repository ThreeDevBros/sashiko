import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const DEEP_LINK_DEDUPE_MS = 3000;

export const AppRuntimeListeners = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const lastHandledUrlRef = useRef<{ url: string; at: number } | null>(null);

  currentPathRef.current = location.pathname;
  usePushNotifications(navigate);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.getPlatform() === 'web') return;

        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('appUrlOpen', (event: { url: string }) => {
          const url = event.url;
          const match = url.match(/sashiko:\/\/order-tracking\/([a-f0-9-]+)/i);

          if (!match?.[1]) {
            console.log('[DeepLink] Ignored non-order URL:', url);
            return;
          }

          const targetPath = `/order-tracking/${match[1]}`;
          const now = Date.now();
          const previous = lastHandledUrlRef.current;
          const duplicateBurst = previous?.url === url && now - previous.at < DEEP_LINK_DEDUPE_MS;
          const alreadyOnTarget = currentPathRef.current === targetPath;

          console.log('[DeepLink] URL opened:', url, 'target:', targetPath, 'alreadyOnTarget:', alreadyOnTarget, 'duplicateBurst:', duplicateBurst);

          if (duplicateBurst || alreadyOnTarget) return;

          lastHandledUrlRef.current = { url, at: now };
          navigate(targetPath);
        });

        cleanup = () => {
          void listener.remove();
        };

        console.log('[DeepLink] Native appUrlOpen listener registered');
      } catch (err) {
        console.log('[DeepLink] Not available:', err);
      }
    })();

    return () => cleanup?.();
  }, [navigate]);

  return null;
};
