import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmV2 } from "../_shared/fcm-v2.ts";
import { sendLiveActivityUpdate } from "../_shared/apns-live-activity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getStatusMessage(status: string, orderType: string): string {
  const messages: Record<string, Record<string, string>> = {
    confirmed: {
      delivery: 'Your order has been confirmed',
      pickup: 'Your order has been confirmed',
      dine_in: 'Your order has been confirmed',
    },
    preparing: {
      delivery: 'Preparing your food',
      pickup: 'Preparing your food',
      dine_in: 'Preparing your food',
    },
    ready: {
      delivery: 'Your food is ready, waiting for driver',
      pickup: 'Your food is ready for pickup',
      dine_in: 'Your food is ready',
    },
    out_for_delivery: {
      delivery: 'Your order is on its way',
      pickup: 'Your order is on its way',
      dine_in: 'Your order is on its way',
    },
    delivered: {
      delivery: 'Your order has been delivered',
      pickup: 'Your order has been picked up',
      dine_in: 'Your order is complete',
    },
    cancelled: {
      delivery: 'Your order has been cancelled',
      pickup: 'Your order has been cancelled',
      dine_in: 'Your order has been cancelled',
    },
  };
  return messages[status]?.[orderType] || messages[status]?.delivery || `Order status updated to ${status}`;
}

const statusToLiveState: Record<string, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  preparing: 'preparing',
  ready: 'ready',
  out_for_delivery: 'onTheWay',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { order_id, new_status } = await req.json();
    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ error: 'order_id and new_status required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('user_id, display_number, order_number, order_type, estimated_ready_at, delivery_transit_minutes')
      .eq('id', order_id)
      .single();

    if (orderErr || !order?.user_id) {
      return new Response(JSON.stringify({ sent: 0, liveActivitySent: 0, reason: 'No user_id on order' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderLabel = order.display_number != null
      ? `#${String(order.display_number).padStart(3, '0')}`
      : `#${order.order_number.slice(-6)}`;

    const messageTemplate = getStatusMessage(new_status, order.order_type);
    const isTerminalStatus = ['delivered', 'cancelled'].includes(new_status);
    const title = isTerminalStatus ? `Order ${orderLabel}` : `Order ${orderLabel} Update`;

    // Compute ETA = prep time remaining + delivery transit time
    let etaMinutes: number | null = null;
    if (order.estimated_ready_at && !isTerminalStatus) {
      const diffMs = new Date(order.estimated_ready_at).getTime() - Date.now();
      const prepMinutes = Math.max(0, Math.ceil(diffMs / 60000));
      const transitMinutes = (order.order_type === 'delivery' && order.delivery_transit_minutes) ? order.delivery_transit_minutes : 0;
      etaMinutes = prepMinutes + transitMinutes;
    }

    // Build body with ETA
    let body = messageTemplate;
    if (etaMinutes != null && etaMinutes > 0) {
      body += ` — ~${etaMinutes} min`;
    }

    // Store last push state for ETA-only refreshes
    await supabase
      .from('orders')
      .update({
        last_push_status: new_status,
        last_push_message: messageTemplate,
      })
      .eq('id', order_id);

    // --- FCM Push Notifications — only for terminal statuses (delivered/cancelled) ---
    let fcmResult = { sent: 0, failed: 0, attempted: 0, skipped_invalid: 0, errors: [] as string[] };
    if (isTerminalStatus) {
      const { data: tokens } = await supabase
        .from('push_device_tokens')
        .select('token')
        .eq('user_id', order.user_id);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: any) => ({
          token: t.token,
          title,
          body,
          collapseKey: `order_${order_id}`,
          ongoing: false,
          data: {
            type: 'order_status',
            order_id,
            status: new_status,
          },
        }));
        fcmResult = await sendFcmV2(messages);
      }
    }

    // --- Live Activity Updates (all values must be strings for Swift Codable) ---
    let liveActivitySent = 0;
    const { data: laTokens } = await supabase
      .from('live_activity_tokens')
      .select('push_token')
      .eq('order_id', order_id)
      .eq('user_id', order.user_id);

    if (laTokens && laTokens.length > 0) {
      const bundleId = Deno.env.get('IOS_BUNDLE_ID') || Deno.env.get('APP_BUNDLE_ID') || 'com.sashiko.app';
      const isTerminal = ['delivered', 'cancelled'].includes(new_status);

      const updates = laTokens.map((t: any) => ({
        pushToken: t.push_token,
        event: isTerminal ? 'end' as const : 'update' as const,
        contentState: {
          status: statusToLiveState[new_status] || new_status,
          orderId: order_id,
          orderType: order.order_type,
          statusMessage: messageTemplate,
          etaMinutes: etaMinutes != null ? String(etaMinutes) : '',
          updatedAt: new Date().toISOString(),
        },
        staleDate: Math.floor(Date.now() / 1000) + 120,
        ...(isTerminal && { dismissalDate: Math.floor(Date.now() / 1000) + 300 }),
        relevanceScore: isTerminal ? 0 : 75,
      }));

      liveActivitySent = await sendLiveActivityUpdate(updates, bundleId);
    }

    return new Response(JSON.stringify({ sent: fcmResult.sent, liveActivitySent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Send order push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
