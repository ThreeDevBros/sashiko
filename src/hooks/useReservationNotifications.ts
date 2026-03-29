import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';

export const useReservationNotifications = () => {
  const { toast } = useToast();
  const { isAdmin, loading } = useAdmin();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [newReservation, setNewReservation] = useState<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    console.log('🔍 useReservationNotifications: isAdmin =', isAdmin, 'loading =', loading);
    
    // Wait for admin status to load
    if (loading) {
      console.log('⏳ Still loading admin status...');
      return;
    }
    
    // Only set up notifications for admins
    if (!isAdmin) {
      console.log('❌ Not admin, skipping notification setup');
      // Clean up any existing channel
      if (channelRef.current) {
        console.log('🧹 Removing existing channel for non-admin');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Don't create a new channel if one already exists
    if (channelRef.current) {
      console.log('✅ Channel already exists, skipping setup');
      return;
    }

    console.log('🚀 Setting up reservation notifications for admin user');

    // Create audio element for notification sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjOH0fPTgjMGHm7A7+OZQQ8PVanq8alkGAg+ltzzxngsBSJzv+rcmz0NEVSn6PGqahoIOpPY8cmCLQUicL3r3Js9DhFUp+jxqmoaCDqT2PHJgi0FInC969ybPQ4RVKfo8apqGgg6k9jxyYItBSJwvevdmz0OEVSn6PGqahoIOpPY8cmCLQUicL3r3Zs9DhFUp+jxqmoaCDqT2PHJgi0FInC969ybPQ4RVKfo8apqGgg6k9jxyYItBSJwvevdmz0OEVSn6PGqahoIOpPY8cmCLQUicL3r3Zs9DhFUp+jxqmoaCDqT2PHJgi0FInC969ybPQ4RVKfo8apqGgg6k9jxyYItBSJwvevdmz0OEVSn6PGqahoIOpPY8cmCLQUicL3r3Zs9DhFUp+jxqmoaCDqT2PHJgi0FInC969ybPQ4RVKfo8apqGgg6k9jxyYItBSJwvevdmz0OEVSn6PGqahoIOpPY8cmCLQUicL3r3Zs9DhFUp+jxqmoaCDqT2PHJgi0FInC969ybPQ4RVKfo8apqGgg6k9jxyYItBSJwvevdmz0OEVSn6PGqahoIOpPY8cmCLQUicL3r3Zs9DhFUp+jxqmoaCDqT2PHJgi0FInC969ybPQ4RVKfo8apqGgg6k9jxyYItBSJwvevdmz0OEVSn6PGqahoI');

    const channel = supabase
      .channel('reservation-notifications-unique', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_reservations'
        },
        (payload: any) => {
          console.log('🔔 New reservation received via realtime:', payload);
          
          // Play notification sound
          if (audioRef.current) {
            audioRef.current.play().catch(err => {
              console.error('❌ Failed to play notification sound:', err);
            });
          }

          // Set the new reservation to trigger dialog
          const reservation = payload.new;
          console.log('📝 Setting new reservation state:', reservation);
          setNewReservation(reservation);

          // Also show toast as backup
          toast({
            title: '🔔 New Reservation!',
            description: `${reservation.guest_name || 'Guest'} - Party of ${reservation.party_size} - ${new Date(reservation.reservation_date).toLocaleDateString()} at ${reservation.start_time}`,
            duration: 10000,
          });
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Reservation notification channel status:', status);
        if (err) {
          console.error('❌ Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to reservation notifications!');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('🧹 Cleaning up reservation notifications');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isAdmin, loading, toast]);

  return {
    newReservation,
    clearNotification: () => {
      console.log('🗑️ Clearing notification');
      setNewReservation(null);
    },
  };
};
