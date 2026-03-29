import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHaptics } from './useHaptics';

// Audio file for order alert - using a simple beep pattern
const ALERT_AUDIO_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

export const useOrderAlerts = (pendingOrderIds: string[] = []) => {
  const { heavy } = useHaptics();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAlertingRef = useRef(false);
  const previousPendingIdsRef = useRef<Set<string>>(new Set());

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(ALERT_AUDIO_URL);
    audioRef.current.volume = 1.0;
    
    return () => {
      stopAlerts();
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

  const startAlerts = useCallback(() => {
    if (isAlertingRef.current) return;
    
    isAlertingRef.current = true;
    console.log('🔔 Starting order alerts');
    
    // Play sound immediately
    playAlertSound();
    triggerVibration();
    
    // Set up repeating audio alert every 3 seconds
    alertIntervalRef.current = setInterval(() => {
      playAlertSound();
    }, 3000);
    
    // Set up repeating vibration every 2 seconds
    vibrationIntervalRef.current = setInterval(() => {
      triggerVibration();
    }, 2000);
  }, [playAlertSound, triggerVibration]);

  const stopAlerts = useCallback(() => {
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
  }, []);

  // Check for new pending orders and manage alerts
  useEffect(() => {
    const currentPendingIds = new Set(pendingOrderIds);
    const previousPendingIds = previousPendingIdsRef.current;
    
    // Find truly new orders (not just orders that were already pending)
    const newOrders = pendingOrderIds.filter(id => !previousPendingIds.has(id));
    
    // If there are new pending orders, start alerting
    if (newOrders.length > 0 && pendingOrderIds.length > 0) {
      startAlerts();
    }
    
    // If no more pending orders, stop alerting
    if (pendingOrderIds.length === 0) {
      stopAlerts();
    }
    
    // Update previous pending IDs
    previousPendingIdsRef.current = currentPendingIds;
  }, [pendingOrderIds, startAlerts, stopAlerts]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAlerts();
    };
  }, [stopAlerts]);

  return {
    startAlerts,
    stopAlerts,
    isAlerting: isAlertingRef.current,
  };
};
