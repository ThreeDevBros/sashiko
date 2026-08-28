import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole, STAFF_ROLES } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Only staff/admin (or the assigned driver) may trigger customer notifications
    const authResult = await requireRole(req, supabase, STAFF_ROLES, corsHeaders);
    if ('response' in authResult) return authResult.response;

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id required');

    // Fetch order with branch info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, branches(name, address, city, phone)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    // Get recipient email
    let recipientEmail: string | null = null;
    if (order.user_id) {
      const { data: { user } } = await supabase.auth.admin.getUserById(order.user_id);
      recipientEmail = user?.email || null;
    } else {
      recipientEmail = order.guest_email;
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch order items with menu item names and modifiers
    const { data: items } = await supabase
      .from('order_items')
      .select('*, menu_items(name), order_item_modifiers(*, modifiers(name))')
      .eq('order_id', order_id);

    // Get tenant settings for currency
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('currency, tenant_name')
      .limit(1)
      .single();

    const currency = settings?.currency || 'USD';
    const tenantName = settings?.tenant_name || 'Sashiko Asian Fusion';
    const branch = order.branches as any;

    const itemLines = (items || []).map((item: any) => ({
      name: item.menu_items?.name || 'Unknown Item',
      quantity: item.quantity,
      modifiers: (item.order_item_modifiers || [])
        .map((m: any) => m.modifiers?.name)
        .filter(Boolean)
        .join(', '),
      specialInstructions: item.special_instructions || undefined,
      totalPrice: Number(item.total_price).toFixed(2),
    }));

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const templateData = {
      tenantName,
      orderNumber: String(order.order_number),
      orderDate,
      currency,
      items: itemLines,
      subtotal: Number(order.subtotal).toFixed(2),
      deliveryFee: order.delivery_fee ? Number(order.delivery_fee).toFixed(2) : undefined,
      tax: order.tax ? Number(order.tax).toFixed(2) : undefined,
      tip: order.tip ? Number(order.tip).toFixed(2) : undefined,
      total: Number(order.total).toFixed(2),
      branchName: branch?.name,
      branchAddress: branch ? `${branch.address}, ${branch.city}` : undefined,
    };

    const logSend = async (status: string, errorMessage?: string) => {
      const { error: logError } = await supabase.from('email_send_log').insert({
        template_name: 'order_delivered',
        recipient_email: recipientEmail,
        status,
        error_message: errorMessage,
        metadata: { order_id, order_number: order.order_number },
      });
      if (logError) console.error('Failed to write email_send_log row', logError);
    };

    try {
      const result = await sendTemplateEmail('order-delivered', recipientEmail, {
        templateData,
        idempotencyKey: `order-delivered-${order_id}`,
      });

      if (!result.sent) {
        await logSend('suppressed');
        return new Response(JSON.stringify({ skipped: true, reason: result.reason }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await logSend('sent');
    } catch (sendError: any) {
      await logSend('failed', String(sendError?.message ?? sendError).slice(0, 1000));
      throw sendError;
    }



    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('send-order-email error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
