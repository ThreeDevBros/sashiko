// Capacitor bridge for iOS Live Activities (ActivityKit)
// This file provides helpers to start/stop/update Live Activities
// and register their push tokens with the backend.

import { supabase } from '@/integrations/supabase/client';

interface LiveActivityData {
  orderId: string;
  orderNumber: string;
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  statusMessage: string;
  etaMinutes: number | null;
}

interface StartLiveActivityResult {
  activityId: string;
  pushToken: string | null;
}

/**
 * Check if Live Activities are supported (iOS 16.1+)
 */
export async function areLiveActivitiesSupported(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return false;

    const plugin = (Capacitor as any).Plugins?.LiveActivityPlugin;
    if (!plugin) return false;

    const result = await plugin.areActivitiesEnabled();
    return result?.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Start a Live Activity for an order and register the push token
 */
export async function startOrderLiveActivity(data: LiveActivityData): Promise<string | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return null;

    const plugin = (Capacitor as any).Plugins?.LiveActivityPlugin;
    if (!plugin) return null;

    const result: StartLiveActivityResult = await plugin.startActivity({
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      orderType: data.orderType,
      status: data.status,
      statusMessage: data.statusMessage,
      etaMinutes: data.etaMinutes,
    });

    // Register the push token with the backend
    if (result.pushToken) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('live_activity_tokens').upsert(
          {
            user_id: user.id,
            order_id: data.orderId,
            push_token: result.pushToken,
            platform: 'ios',
          },
          { onConflict: 'user_id,order_id' }
        );
      }
    }

    return result.activityId;
  } catch (err) {
    console.error('Failed to start Live Activity:', err);
    return null;
  }
}

/**
 * Update a Live Activity's content state locally (status + ETA)
 * without restarting it. Also pushes the update to the native widget.
 */
export async function updateOrderLiveActivity(data: LiveActivityData): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return;

    const plugin = (Capacitor as any).Plugins?.LiveActivityPlugin;
    if (!plugin?.updateActivity) return;

    await plugin.updateActivity({
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      orderType: data.orderType,
      status: data.status,
      statusMessage: data.statusMessage,
      etaMinutes: data.etaMinutes,
    });
  } catch (err) {
    console.error('Failed to update Live Activity:', err);
  }
}

/**
 * End a Live Activity
 */
export async function endOrderLiveActivity(orderId: string): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'ios') return;

    const plugin = (Capacitor as any).Plugins?.LiveActivityPlugin;
    if (!plugin) return;

    await plugin.endActivity({ orderId });

    // Clean up token from DB
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('live_activity_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('order_id', orderId);
    }
  } catch (err) {
    console.error('Failed to end Live Activity:', err);
  }
}
