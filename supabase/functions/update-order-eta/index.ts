import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmV2 } from "../_shared/fcm-v2.ts";
import { sendLiveActivityUpdate } from "../_shared/apns-live-activity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all active orders with ETA and a stored push message
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, user_id, display_number, order_number, order_type, estimated_ready_at, last_push_status, last_push_message')
      .not('status', 'in', '("delivered","cancelled","pending")')
      .not('estimated_ready_at', 'is', null)
      .not('last_push_message', 'is', null)
      .not('user_id', 'is', null);

    if (error) {
      console.error('[ETA Refresh] Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0, reason: 'No active orders with ETA' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ETA Refresh] Processing ${orders.length} active orders`);

    let totalSent = 0;
    let totalLiveActivitySent = 0;

    const statusToLiveState: Record<string, string> = {
      pending: 'pending',
      confirmed: 'confirmed',
      preparing: 'preparing',
      ready: 'ready',
      out_for_delivery: 'onTheWay',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };

    for (const order of orders) {
      const diffMs = new Date(order.estimated_ready_at).getTime() - Date.now();
      const etaMinutes = Math.max(0, Math.ceil(diffMs / 60000));

      const orderLabel = order.display_number != null
        ? `#${String(order.display_number).padStart(3, '0')}`
        : `#${order.order_number.slice(-6)}`;

      const isTerminal = ['delivered', 'cancelled'].includes(order.last_push_status);
      const title = isTerminal ? `Order ${orderLabel}` : `Order ${orderLabel} Update`;

      // Rebuild body: same status message + updated ETA
      let body = order.last_push_message;
      if (etaMinutes > 0) {
        body += ` — Ready in ~${etaMinutes} min`;
      }

      // --- FCM Push ---
      const { data: tokens } = await supabase
        .from('push_device_tokens')
        .select('token')
        .eq('user_id', order.user_id);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: any) => ({
          token: t.token,
          title,
          body,
          collapseKey: `order_${order.id}`,
          ongoing: true,
          data: {
            type: 'order_status',
            order_id: order.id,
            status: order.last_push_status,
          },
        }));

        const result = await sendFcmV2(messages);
        totalSent += result.sent;
      }

      // --- Live Activity APNs Updates ---
      const { data: laTokens } = await supabase
        .from('live_activity_tokens')
        .select('push_token')
        .eq('order_id', order.id)
        .eq('user_id', order.user_id);

      if (laTokens && laTokens.length > 0) {
        const bundleId = Deno.env.get('IOS_BUNDLE_ID') || 'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10';

        const updates = laTokens.map((t: any) => ({
          pushToken: t.push_token,
          event: 'update' as const,
          contentState: {
            status: statusToLiveState[order.last_push_status] || order.last_push_status,
            orderNumber: orderLabel,
            orderType: order.order_type,
            statusMessage: order.last_push_message,
            etaMinutes,
            updatedAt: new Date().toISOString(),
          },
          staleDate: Math.floor(Date.now() / 1000) + 180,
          relevanceScore: 75,
        }));

        const laSent = await sendLiveActivityUpdate(updates, bundleId);
        totalLiveActivitySent += laSent;
      }
    }

    console.log(`[ETA Refresh] FCM sent: ${totalSent}, Live Activities sent: ${totalLiveActivitySent}`);

    return new Response(JSON.stringify({ refreshed: orders.length, sent: totalSent, liveActivitySent: totalLiveActivitySent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[ETA Refresh] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
