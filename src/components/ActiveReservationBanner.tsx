import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CalendarCheck, X, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const SHOW_STATUSES = ['pending', 'confirmed', 'rejected'];

export const ActiveReservationBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<any>(null);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_reservation_ids') || '[]');
    } catch { return []; }
  });

  const statusConfig: Record<string, { icon: typeof Clock; label: string; sublabel: string; color: string }> = {
    pending: { icon: Clock, label: t('banners.reservationPending'), sublabel: t('banners.waitingConfirmation'), color: 'text-amber-500' },
    confirmed: { icon: CalendarCheck, label: t('banners.reservationConfirmed'), sublabel: t('banners.tableBooked'), color: 'text-green-500' },
    rejected: { icon: X, label: t('banners.reservationRejected'), sublabel: t('banners.tapDetails'), color: 'text-red-500' },
  };

  useEffect(() => {
    let cancelled = false;

    const fetchReservation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setReservation(null);
        return;
      }

      const { data } = await supabase
        .from('table_reservations')
        .select('id, status, reservation_date, start_time, end_time, party_size, admin_notes, branches(name)')
        .eq('user_id', user.id)
        .in('status', SHOW_STATUSES)
        .order('created_at', { ascending: false })
        .limit(10);

      if (cancelled) return;

      const now = new Date();
      const active = (data || []).find((r: any) => {
        if (r.status === 'rejected') {
          return !dismissedIds.includes(r.id);
        }
        const endDt = new Date(r.reservation_date + 'T' + r.end_time);
        return endDt > now;
      });

      setReservation(active || null);
    };

    fetchReservation();

    const channel = supabase
      .channel('active-reservation-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_reservations' }, () => {
        fetchReservation();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [dismissedIds]);

  const handleTap = () => {
    if (!reservation) return;
    if (reservation.status === 'rejected') {
      setRejectionDialogOpen(true);
    } else {
      navigate('/reservation-history');
    }
  };

  const handleDismissRejection = () => {
    if (!reservation) return;
    const updated = [...dismissedIds, reservation.id];
    setDismissedIds(updated);
    localStorage.setItem('dismissed_reservation_ids', JSON.stringify(updated));
    setRejectionDialogOpen(false);
    setReservation(null);
    navigate('/reservation-history');
  };

  const config = reservation ? statusConfig[reservation.status] : null;
  const StatusIcon = config?.icon || Clock;

  return (
    <>
      <AnimatePresence>
        {reservation && config && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={handleTap}
            className="cursor-pointer group"
          >
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-4 shadow-lg hover:shadow-xl transition-all hover:border-primary/40 active:scale-[0.98]">
              <div className="absolute top-3 right-3">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    reservation.status === 'pending' ? 'bg-amber-500' :
                    reservation.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    reservation.status === 'pending' ? 'bg-amber-500' :
                    reservation.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-card shadow-sm ${config.color}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {config.sublabel}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">{t('banners.rejectedTitle')}</DialogTitle>
            <DialogDescription>
              {t('banners.rejectedDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">{t('banners.rejectedReason')}</p>
            <p className="text-sm text-foreground">
              {reservation?.admin_notes || t('banners.noReason')}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleDismissRejection} className="w-full">
              {t('banners.okGotIt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};