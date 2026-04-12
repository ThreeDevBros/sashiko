import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, user_id, order_type, estimated_ready_at, last_push_status, last_push_message, delivery_transit_minutes')
      .not('status', 'in', '("delivered","cancelled","pending")')
      .not('estimated_ready_at', 'is', null)
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

    let totalLiveActivitySent = 0;

    const statusToLiveState: Record<string, string> = {
      pending: 'pending',
      confirmed: 'confirmed',
      preparing: 'preparing',
      ready: 'ready',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };

    for (const order of orders) {
      const diffMs = new Date(order.estimated_ready_at).getTime() - Date.now();
      const prepMinutes = Math.max(0, Math.ceil(diffMs / 60000));
      const transitMinutes = (order.order_type === 'delivery' && order.delivery_transit_minutes) ? order.delivery_transit_minutes : 0;
      const etaMinutes = prepMinutes + transitMinutes;

      const { data: laTokens } = await supabase
        .from('live_activity_tokens')
        .select('push_token')
        .eq('order_id', order.id)
        .eq('user_id', order.user_id);

      if (laTokens && laTokens.length > 0) {
        const bundleId = Deno.env.get('IOS_BUNDLE_ID') || Deno.env.get('APP_BUNDLE_ID') || 'com.sashiko.app';

        const updates = laTokens.map((t: any) => ({
          pushToken: t.push_token,
          event: 'update' as const,
          contentState: {
            values: {
              status: statusToLiveState[order.last_push_status] || order.last_push_status,
              orderId: order.id,
              orderType: order.order_type,
              statusMessage: order.last_push_message || '',
              etaMinutes: String(etaMinutes),
              updatedAt: new Date().toISOString(),
            },
          },
          // 10-minute stale window
          staleDate: Math.floor(Date.now() / 1000) + 600,
          relevanceScore: 75,
        }));

        const laSent = await sendLiveActivityUpdate(updates, bundleId);
        totalLiveActivitySent += laSent;
      }
    }

    console.log(`[ETA Refresh] Live Activities sent: ${totalLiveActivitySent}`);

    return new Response(JSON.stringify({ refreshed: orders.length, liveActivitySent: totalLiveActivitySent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[ETA Refresh] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
