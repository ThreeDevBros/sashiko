// Capacitor bridge for iOS Live Activities (ActivityKit)
// Uses a custom native LiveActivityPlugin registered as "LiveActivity".
// Registers push-to-update tokens with the backend for server-driven updates.

import { supabase } from '@/integrations/supabase/client';

interface LiveActivityData {
  orderId: string;
  orderType: 'delivery' | 'pickup' | 'dine_in';
  status: string;
  statusMessage: string;
  etaMinutes: number | null;
}

/**
 * Get the native LiveActivity plugin via Capacitor's plugin registry
 */
async function getLiveActivityPlugin(): Promise<any | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    if (platform !== 'ios') return null;
    const plugin = (Capacitor as any).Plugins?.LiveActivity;
    if (!plugin) {
      console.warn('[LiveActivity] Plugin not registered.');
    }
    return plugin || null;
  } catch (err) {
    console.error('[LiveActivity] Error getting plugin:', err);
    return null;
  }
}

/**
 * Check if Live Activities are supported (iOS 16.2+)
 */
export async function areLiveActivitiesSupported(): Promise<boolean> {
  try {
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return false;
    const result = await plugin.isAvailable();
    return result.value === true;
  } catch {
    return false;
  }
}

/**
 * Build the content state object sent to the widget.
 * All values MUST be strings to match Swift's [String: String] Codable type.
 */
function buildContentState(data: LiveActivityData): Record<string, string> {
  return {
    status: data.status,
    orderId: data.orderId,
    orderType: data.orderType,
    statusMessage: data.statusMessage,
    etaMinutes: data.etaMinutes != null ? String(data.etaMinutes) : '',
    updatedAt: new Date().toISOString(),
  };
}

// ─── Persistent mapping: activityId ↔ orderId ───
// Stored in localStorage so it survives app kills on iOS.
const MAPPING_KEY = 'liveactivity_id_map';

function loadMapping(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMapping(map: Record<string, string>) {
  try {
    localStorage.setItem(MAPPING_KEY, JSON.stringify(map));
  } catch {}
}

function setMappingEntry(activityId: string, orderId: string) {
  const map = loadMapping();
  map[activityId] = orderId;
  saveMapping(map);
}

function getOrderIdForActivity(activityId: string): string | null {
  return loadMapping()[activityId] ?? null;
}

function removeMappingByOrderId(orderId: string) {
  const map = loadMapping();
  for (const [actId, oId] of Object.entries(map)) {
    if (oId === orderId) {
      delete map[actId];
    }
  }
  saveMapping(map);
}

let pushTokenListenerRegistered = false;

/**
 * Start a Live Activity for an order and register the push token.
 * Cleans up any stale tokens for this user+order before starting.
 */
export async function startOrderLiveActivity(data: LiveActivityData): Promise<string | null> {
  try {
    if (!data.orderId) {
      console.warn('[LiveActivity] startOrderLiveActivity called without orderId — skipping');
      return null;
    }
    console.log('[LiveActivity] startOrderLiveActivity called for order:', data.orderId);
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return null;

    // Clean up stale tokens for this user+order before starting a new activity
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('live_activity_tokens')
          .delete()
          .eq('user_id', session.user.id)
          .eq('order_id', data.orderId);
        console.log('[LiveActivity] Cleaned up stale tokens for order:', data.orderId);
      }
    } catch (cleanupErr) {
      console.warn('[LiveActivity] Token cleanup failed (non-fatal):', cleanupErr);
    }

    // Register push token listener once — uses persistent mapping for exact matching
    if (!pushTokenListenerRegistered && plugin.addListener) {
      pushTokenListenerRegistered = true;
      plugin.addListener('liveActivityPushToken', async (event: any) => {
        const activityId = event.activityId;
        const orderId = activityId ? getOrderIdForActivity(activityId) : null;
        console.log('[LiveActivity] Push token received — activityId:', activityId, 'orderId:', orderId, 'token:', event.token?.substring(0, 20) + '...');
        if (!orderId) {
          console.warn('[LiveActivity] No orderId found for activityId:', activityId);
          return;
        }
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          if (userId) {
            await supabase
              .from('live_activity_tokens')
              .delete()
              .eq('user_id', userId)
              .eq('order_id', orderId);

            const { error } = await supabase.from('live_activity_tokens').insert({
              user_id: userId,
              order_id: orderId,
              push_token: event.token,
              platform: 'ios',
            });
            if (error) {
              console.error('[LiveActivity] Token insert error:', error);
            } else {
              console.log('[LiveActivity] Token persisted for order:', orderId);
            }
          }
        } catch (err) {
          console.error('[LiveActivity] Failed to register push token:', err);
        }
      });
    }

    const contentState = buildContentState(data);
    console.log('[LiveActivity] Starting activity with state:', contentState);

    const result = await plugin.startActivityWithPush({
      id: data.orderId,
      contentState,
    });

    // Persist the native activityId → orderId mapping
    if (result.activityId) {
      setMappingEntry(result.activityId, data.orderId);
      console.log('[LiveActivity] Mapped activityId:', result.activityId, '-> orderId:', data.orderId);
    }

    console.log('[LiveActivity] Activity started, activityId:', result.activityId);
    return result.activityId;
  } catch (err) {
    console.error('[LiveActivity] Failed to start Live Activity:', err);
    return null;
  }
}

/**
 * Update a Live Activity's content state (status + ETA)
 */
export async function updateOrderLiveActivity(data: LiveActivityData): Promise<void> {
  try {
    if (!data.orderId) {
      console.warn('[LiveActivity] updateOrderLiveActivity called without orderId — skipping');
      return;
    }
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return;

    await plugin.updateActivity({
      id: data.orderId,
      contentState: buildContentState(data),
    });
  } catch (err) {
    console.error('[LiveActivity] Failed to update Live Activity:', err);
  }
}

/**
 * End a Live Activity
 */
export async function endOrderLiveActivity(orderId: string): Promise<void> {
  try {
    if (!orderId) return;
    const plugin = await getLiveActivityPlugin();
    if (!plugin) return;

    await plugin.endActivity({
      id: orderId,
      contentState: {
        status: 'delivered',
        orderId: orderId,
        statusMessage: 'Order complete',
        etaMinutes: '0',
        updatedAt: new Date().toISOString(),
      },
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('live_activity_tokens')
        .delete()
        .eq('user_id', session.user.id)
        .eq('order_id', orderId);
    }

    // Clean up persistent mapping
    removeMappingByOrderId(orderId);

    console.log('[LiveActivity] Activity ended');
  } catch (err) {
    console.error('[LiveActivity] Failed to end Live Activity:', err);
  }
}
