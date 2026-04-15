import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigation, MapPin, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isGeolocationAvailable, watchPosition, clearWatch as geoClearWatch } from '@/lib/geolocation';

interface DriverLocationTrackerProps {
  orderId: string;
  onLocationUpdate?: (location: GeolocationPosition) => void;
}

export function DriverLocationTracker({ orderId, onLocationUpdate }: DriverLocationTrackerProps) {
  const [tracking, setTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        geoClearWatch(watchIdRef.current);
      }
    };
  }, []);

  const startTracking = async () => {
    if (!isGeolocationAvailable()) {
      setError('Geolocation is not supported by your browser');
      toast({
        title: 'Error',
        description: 'Geolocation is not supported by your browser',
        variant: 'destructive',
      });
      return;
    }

    setError(null);
    setTracking(true);

    try {
      const id = await watchPosition(
        async (position) => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              throw new Error('User not authenticated');
            }

            const heading = position.coords.heading;
            const speed = position.coords.speed ? position.coords.speed * 3.6 : null;

            const { error } = await supabase
              .from('driver_locations')
              .upsert({
                driver_id: user.id,
                order_id: orderId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                heading: heading,
                speed: speed,
                accuracy: position.coords.accuracy,
              }, { onConflict: 'order_id' });

            if (error) throw error;

            setLastUpdate(new Date());
            onLocationUpdate?.(position as any);
          } catch (err) {
            console.error('Error updating location:', err);
            setError('Failed to update location');
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          setError(`Error: ${err.message || 'Unknown error'}`);
          setTracking(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
      watchIdRef.current = id;
    } catch (err) {
      console.error('Failed to start tracking:', err);
      setError('Failed to start location tracking');
      setTracking(false);
    }
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) {
      await geoClearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${tracking ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
              <Navigation className={`h-5 w-5 ${tracking ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="font-semibold">Location Tracking</h3>
              <p className="text-sm text-muted-foreground">
                {tracking ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
          <Badge variant={tracking ? 'default' : 'secondary'}>
            {tracking ? 'Tracking' : 'Not Tracking'}
          </Badge>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {lastUpdate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}

        <div className="flex gap-2">
          {!tracking ? (
            <Button onClick={startTracking} className="w-full">
              Start Tracking
            </Button>
          ) : (
            <Button onClick={stopTracking} variant="destructive" className="w-full">
              Stop Tracking
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
          <p className="font-semibold mb-1">How it works:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Click "Start Tracking" to share your location</li>
            <li>Your location updates automatically every few seconds</li>
            <li>Customers can see your location in real-time</li>
            <li>Click "Stop Tracking" when delivery is complete</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
