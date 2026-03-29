import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global driver GPS tracker that runs on ANY page of the app when the driver
 * has active deliveries. Uses Wake Lock API to keep the screen/app alive.
 * 
 * Renders nothing visible — it's a background service component.
 */
export function GlobalDriverTracker() {
  const [isDriver, setIsDriver] = useState(false);
  const [activeOrderIds, setActiveOrderIds] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Check if the current user is a driver and has active orders
  const checkDriverStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsDriver(false);
        setActiveOrderIds([]);
        return;
      }

      userIdRef.current = user.id;

      // Check if user has delivery role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['delivery', 'admin']);

      if (!roleData || roleData.length === 0) {
        setIsDriver(false);
        setActiveOrderIds([]);
        return;
      }

      setIsDriver(true);

      // Get active delivery orders assigned to this driver
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('driver_id', user.id)
        .eq('status', 'out_for_delivery');

      const ids = orders?.map(o => o.id) || [];
      setActiveOrderIds(ids);
    } catch (err) {
      console.error('[GlobalDriverTracker] Error checking driver status:', err);
    }
  }, []);

  // Send GPS location for all active orders
  const sendLocation = useCallback(async () => {
    if (activeOrderIds.length === 0 || !userIdRef.current) return;
    if (!navigator.geolocation) return;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        });
      });

      const heading = position.coords.heading;
      const speed = position.coords.speed ? position.coords.speed * 3.6 : null;

      const inserts = activeOrderIds.map(orderId => ({
        driver_id: userIdRef.current!,
        order_id: orderId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        heading,
        speed,
        accuracy: position.coords.accuracy,
      }));

      const { error } = await supabase.from('driver_locations').upsert(inserts, { onConflict: 'order_id' });
      if (error) console.error('[GlobalDriverTracker] Upsert error:', error);
    } catch (err) {
      console.error('[GlobalDriverTracker] GPS error:', err);
    }
  }, [activeOrderIds]);

  // Acquire Wake Lock to prevent screen from sleeping during delivery
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current) return; // Already acquired
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
      console.log('[GlobalDriverTracker] Wake Lock acquired');
    } catch (err) {
      console.warn('[GlobalDriverTracker] Wake Lock failed:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('[GlobalDriverTracker] Wake Lock released');
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeOrderIds.length > 0) {
        acquireWakeLock();
        // Also send a location update immediately when app comes back
        sendLocation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeOrderIds.length, acquireWakeLock, sendLocation]);

  // Initial check + periodic re-check for active orders
  useEffect(() => {
    checkDriverStatus();

    // Re-check every 30 seconds for new active orders
    checkIntervalRef.current = setInterval(checkDriverStatus, 30000);

    // Also listen for realtime order changes
    const channel = supabase
      .channel('global-driver-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        checkDriverStatus();
      })
      .subscribe();

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      supabase.removeChannel(channel);
    };
  }, [checkDriverStatus]);

  // Start/stop GPS tracking based on active orders
  useEffect(() => {
    if (activeOrderIds.length > 0) {
      // Start tracking
      sendLocation(); // Immediately
      intervalRef.current = setInterval(sendLocation, 10000);
      acquireWakeLock();
    } else {
      // Stop tracking
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      releaseWakeLock();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeOrderIds, sendLocation, acquireWakeLock, releaseWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // This component renders nothing
  return null;
}
