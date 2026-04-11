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

  const checkDriverStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsDriver(false);
        setActiveOrderIds([]);
        return;
      }

      userIdRef.current = user.id;

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

  const checkProximity = useCallback(async (orderId: string, lat: number, lng: number) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      if (!projectId) return;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      await fetch(`https://${projectId}.supabase.co/functions/v1/check-driver-proximity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          driver_lat: lat,
          driver_lng: lng,
        }),
      });
    } catch (err) {
      console.error('[GlobalDriverTracker] Proximity check error:', err);
    }
  }, []);

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
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const inserts = activeOrderIds.map(orderId => ({
        driver_id: userIdRef.current!,
        order_id: orderId,
        latitude: lat,
        longitude: lng,
        heading,
        speed,
        accuracy: position.coords.accuracy,
      }));

      const { error } = await supabase.from('driver_locations').upsert(inserts, { onConflict: 'order_id' });
      if (error) {
        console.error('[GlobalDriverTracker] Upsert error:', error);
        return;
      }

      // Check proximity for each active order
      for (const orderId of activeOrderIds) {
        checkProximity(orderId, lat, lng);
      }
    } catch (err) {
      console.error('[GlobalDriverTracker] GPS error:', err);
    }
  }, [activeOrderIds, checkProximity]);

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current) return;
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeOrderIds.length > 0) {
        acquireWakeLock();
        sendLocation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeOrderIds.length, acquireWakeLock, sendLocation]);

  useEffect(() => {
    checkDriverStatus();
    checkIntervalRef.current = setInterval(checkDriverStatus, 30000);

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

  useEffect(() => {
    if (activeOrderIds.length > 0) {
      sendLocation();
      intervalRef.current = setInterval(sendLocation, 10000);
      acquireWakeLock();
    } else {
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

  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return null;
}
