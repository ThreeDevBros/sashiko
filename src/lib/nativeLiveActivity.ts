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
// Stored in native preferences on mobile with localStorage fallback.
const MAPPING_KEY = 'liveactivity_id_map';
let mappingCache: Record<string, string> | null = null;

async function readStoredMapping(): Promise<Record<string, string>> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'web') {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: MAPPING_KEY });
      if (value) return JSON.parse(value);
    }
  } catch {}

  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeStoredMapping(map: Record<string, string>) {
  const serialized = JSON.stringify(map);

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() !== 'web') {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: MAPPING_KEY, value: serialized });
    }
  } catch {}

  try {
    localStorage.setItem(MAPPING_KEY, serialized);
  } catch {}
}

export async function restoreLiveActivityMappings(): Promise<Record<string, string>> {
  mappingCache = await readStoredMapping();
  console.log('[LiveActivity] Restored mapping entries:', Object.keys(mappingCache).length);
  return mappingCache;
}

async function ensureMappingCache() {
  if (mappingCache) return mappingCache;
  return restoreLiveActivityMappings();
}

async function setMappingEntry(activityId: string, orderId: string) {
  const map = await ensureMappingCache();
  map[activityId] = orderId;
  map[orderId] = orderId;
  await writeStoredMapping(map);
}

async function getOrderIdForActivity(activityId: string): Promise<string | null> {
  const map = await ensureMappingCache();
  return map[activityId] ?? null;
}

async function removeMappingByOrderId(orderId: string) {
  const map = await ensureMappingCache();
  for (const [actId, oId] of Object.entries(map)) {
    if (oId === orderId || actId === orderId) {
      delete map[actId];
    }
  }
  await writeStoredMapping(map);
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

    await restoreLiveActivityMappings();

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
        const activityId = event.activityId ?? event.customId ?? null;
        const orderId = event.orderId ?? event.customId ?? (activityId ? await getOrderIdForActivity(activityId) : null);
        console.log('[LiveActivity] Push token received — activityId:', activityId, 'orderId:', orderId, 'token:', event.token?.substring(0, 20) + '...');
        if (!orderId) {
          console.warn('[LiveActivity] Blocking LiveActivity — missing orderId');
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
      await setMappingEntry(result.activityId, data.orderId);
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
    await removeMappingByOrderId(orderId);

    console.log('[LiveActivity] Activity ended');
  } catch (err) {
    console.error('[LiveActivity] Failed to end Live Activity:', err);
  }
}
