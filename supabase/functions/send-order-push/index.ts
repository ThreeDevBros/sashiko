import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmV2 } from "../_shared/fcm-v2.ts";
import { sendLiveActivityUpdate } from "../_shared/apns-live-activity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const statusMessages: Record<string, string> = {
  confirmed: 'Your order has been confirmed!',
  preparing: 'Your order is being prepared',
  ready: 'Your order is ready for pickup!',
  out_for_delivery: 'Your order is on its way!',
  delivered: 'Your order has been delivered',
  cancelled: 'Your order has been cancelled',
};

// Maps order status to a simple state for the Live Activity widget
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

    // Get order details
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('user_id, display_number, order_number, order_type, estimated_ready_at')
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

    const messageTemplate = statusMessages[new_status] || `Order status updated to ${new_status}`;
    const title = `Order ${orderLabel}`;
    const body = messageTemplate;

    // --- FCM Push Notifications ---
    const { data: tokens } = await supabase
      .from('push_device_tokens')
      .select('token')
      .eq('user_id', order.user_id);

    let fcmSent = 0;
    if (tokens && tokens.length > 0) {
      const messages = tokens.map((t: any) => ({
        token: t.token,
        title,
        body,
        data: {
          type: 'order_status',
          order_id,
          status: new_status,
        },
      }));
      fcmSent = await sendFcmV2(messages);
    }

    // --- Live Activity Updates ---
    let liveActivitySent = 0;
    const { data: laTokens } = await supabase
      .from('live_activity_tokens')
      .select('push_token')
      .eq('order_id', order_id)
      .eq('user_id', order.user_id);

    if (laTokens && laTokens.length > 0) {
      const bundleId = Deno.env.get('IOS_BUNDLE_ID') || 'app.lovable.6e0c6b4d4b7943e7a8431d08565d9c10';
      const isTerminal = ['delivered', 'cancelled'].includes(new_status);

      // Calculate ETA minutes remaining
      let etaMinutes: number | null = null;
      if (order.estimated_ready_at) {
        const diffMs = new Date(order.estimated_ready_at).getTime() - Date.now();
        etaMinutes = Math.max(0, Math.ceil(diffMs / 60000));
      }

      const updates = laTokens.map((t: any) => ({
        pushToken: t.push_token,
        event: isTerminal ? 'end' as const : 'update' as const,
        contentState: {
          status: statusToLiveState[new_status] || new_status,
          orderNumber: orderLabel,
          orderType: order.order_type,
          statusMessage: messageTemplate,
          etaMinutes,
          updatedAt: new Date().toISOString(),
        },
        alertTitle: title,
        alertBody: body,
        sound: 'default',
        staleDate: Math.floor(Date.now() / 1000) + 120, // Stale after 2 min
        ...(isTerminal && { dismissalDate: Math.floor(Date.now() / 1000) + 300 }), // Dismiss after 5 min
        relevanceScore: isTerminal ? 0 : 75,
      }));

      liveActivitySent = await sendLiveActivityUpdate(updates, bundleId);
    }

    return new Response(JSON.stringify({ sent: fcmSent, liveActivitySent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Send order push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
