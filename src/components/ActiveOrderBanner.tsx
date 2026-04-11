import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, ChefHat, Clock, ArrowRight } from 'lucide-react';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'] as const;

export const ActiveOrderBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeOrder, setActiveOrder] = useState<{ id: string; order_number: string; status: string } | null>(null);
  const userIdRef = useRef<string | null>(null);

  const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
    pending: { icon: Clock, label: t('banners.orderPlaced'), color: 'text-amber-500' },
    confirmed: { icon: Clock, label: t('orderStatus.confirmed'), color: 'text-blue-500' },
    preparing: { icon: ChefHat, label: t('orderStatus.preparing'), color: 'text-orange-500' },
    ready: { icon: ChefHat, label: t('orderStatus.ready'), color: 'text-green-500' },
    out_for_delivery: { icon: Bike, label: t('orderStatus.onTheWay'), color: 'text-primary' },
  };

  const fetchActiveOrder = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      userIdRef.current = user.id;
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status')
        .eq('user_id', user.id)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveOrder(data);
      return;
    }

    userIdRef.current = null;
    const guestRaw = localStorage.getItem('guest_active_order');
    if (!guestRaw) {
      setActiveOrder(null);
      return;
    }

    try {
      const { id, email } = JSON.parse(guestRaw);
      if (!id || !email) {
        setActiveOrder(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-guest-order', {
        body: { order_id: id, email },
      });

      if (error || !data?.order) {
        localStorage.removeItem('guest_active_order');
        setActiveOrder(null);
        return;
      }

      const order = data.order;
      if (ACTIVE_STATUSES.includes(order.status)) {
        setActiveOrder({ id: order.id, order_number: order.order_number, status: order.status });
      } else {
        localStorage.removeItem('guest_active_order');
        setActiveOrder(null);
      }
    } catch {
      localStorage.removeItem('guest_active_order');
      setActiveOrder(null);
    }
  };

  // Refetch on app resume (native) / tab focus (web)
  useAppLifecycle(() => {
    fetchActiveOrder();
  });

  useEffect(() => {
    fetchActiveOrder();
    const interval = setInterval(fetchActiveOrder, 15000); // Poll every 15s as fallback

    const channel = supabase
      .channel('active-order-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchActiveOrder();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const config = activeOrder ? statusConfig[activeOrder.status] : null;
  const StatusIcon = config?.icon || Clock;

  return (
    <AnimatePresence>
      {activeOrder && config && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={() => navigate(`/order-tracking/${activeOrder.id}`)}
          className="cursor-pointer group"
        >
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-4 shadow-lg hover:shadow-xl transition-all hover:border-primary/40 active:scale-[0.98]">
            <div className="absolute top-3 right-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
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
                  #{activeOrder.order_number} • {t('banners.tapToTrack')}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
