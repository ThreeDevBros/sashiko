import { useEffect, useRef, useCallback } from 'react';
import { useHaptics } from './useHaptics';

const ALERT_AUDIO_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

export const useOrderAlerts = (pendingOrderIds: string[] = []) => {
  const { heavy } = useHaptics();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAlertingRef = useRef(false);
  const previousPendingIdsRef = useRef<Set<string>>(new Set());

  // Stable refs for callbacks
  const startAlertsRef = useRef<() => void>(() => {});
  const stopAlertsRef = useRef<() => void>(() => {});

  useEffect(() => {
    audioRef.current = new Audio(ALERT_AUDIO_URL);
    audioRef.current.volume = 1.0;

    return () => {
      stopAlertsRef.current();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAlertSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Audio play failed:', err);
      });
    }
  }, []);

  const triggerVibration = useCallback(async () => {
    try {
      await heavy();
    } catch (error) {
      console.log('Vibration not available');
    }
  }, [heavy]);

  // Keep refs updated
  useEffect(() => {
    startAlertsRef.current = () => {
      if (isAlertingRef.current) return;
      isAlertingRef.current = true;
      console.log('🔔 Starting order alerts');

      playAlertSound();
      triggerVibration();

      alertIntervalRef.current = setInterval(() => {
        playAlertSound();
      }, 3000);

      vibrationIntervalRef.current = setInterval(() => {
        triggerVibration();
      }, 2000);
    };

    stopAlertsRef.current = () => {
      if (!isAlertingRef.current) return;
      console.log('🔕 Stopping order alerts');
      isAlertingRef.current = false;

      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [playAlertSound, triggerVibration]);

  // Respond to pending order changes using serialized comparison
  const pendingIdsKey = pendingOrderIds.slice().sort().join(',');

  useEffect(() => {
    const currentIds = new Set(pendingOrderIds);
    const previousIds = previousPendingIdsRef.current;

    const newOrders = pendingOrderIds.filter(id => !previousIds.has(id));

    if (newOrders.length > 0 && pendingOrderIds.length > 0) {
      startAlertsRef.current();
    }

    if (pendingOrderIds.length === 0) {
      stopAlertsRef.current();
    }

    previousPendingIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIdsKey]);

  useEffect(() => {
    return () => {
      stopAlertsRef.current();
    };
  }, []);

  return {
    startAlerts: () => startAlertsRef.current(),
    stopAlerts: () => stopAlertsRef.current(),
    isAlerting: isAlertingRef.current,
  };
};
