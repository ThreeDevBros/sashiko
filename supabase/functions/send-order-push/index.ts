import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmV2 } from "../_shared/fcm-v2.ts";

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
      .select('user_id, display_number, order_number')
      .eq('id', order_id)
      .single();

    if (orderErr || !order?.user_id) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No user_id on order' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get device tokens
    const { data: tokens } = await supabase
      .from('push_device_tokens')
      .select('token')
      .eq('user_id', order.user_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No device tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderLabel = order.display_number != null
      ? `#${String(order.display_number).padStart(3, '0')}`
      : `#${order.order_number.slice(-6)}`;

    const messageTemplate = statusMessages[new_status] || `Order status updated to ${new_status}`;
    const title = `Order ${orderLabel}`;
    const body = messageTemplate;

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

    const sent = await sendFcmV2(messages);

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Send order push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
