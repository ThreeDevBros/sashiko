import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Build itemized HTML
    const itemRows = (items || []).map((item: any) => {
      const name = item.menu_items?.name || 'Unknown Item';
      const mods = (item.order_item_modifiers || [])
        .map((m: any) => m.modifiers?.name)
        .filter(Boolean)
        .join(', ');
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;color:#2b2b2b;font-size:14px;">
          ${item.quantity}x ${name}${mods ? `<br/><span style="font-size:12px;color:#737373;">${mods}</span>` : ''}
          ${item.special_instructions ? `<br/><span style="font-size:12px;color:#737373;font-style:italic;">${item.special_instructions}</span>` : ''}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#2b2b2b;font-size:14px;">${currency} ${Number(item.total_price).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px 25px;">
  <img src="https://rfwqbzeutrfccaazvibc.supabase.co/storage/v1/object/public/restaurant-images/email%2Fsashiko-logo.png" width="120" alt="${tenantName}" style="margin-bottom:24px;" />
  <h1 style="font-size:22px;font-weight:bold;color:hsl(0,0%,17%);margin:0 0 20px;">Your order has been delivered! 🎉</h1>
  <p style="font-size:14px;color:hsl(0,0%,45%);line-height:1.5;margin:0 0 8px;">Order <strong>#${order.order_number}</strong></p>
  <p style="font-size:14px;color:hsl(0,0%,45%);line-height:1.5;margin:0 0 20px;">${orderDate}</p>
  
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead><tr>
      <th style="text-align:left;padding:8px 0;border-bottom:2px solid hsl(43,48%,58%);color:hsl(0,0%,17%);font-size:13px;">Items</th>
      <th style="text-align:right;padding:8px 0;border-bottom:2px solid hsl(43,48%,58%);color:hsl(0,0%,17%);font-size:13px;">Price</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table style="width:100%;margin-bottom:24px;">
    <tr><td style="padding:4px 0;font-size:14px;color:hsl(0,0%,45%);">Subtotal</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,45%);">${currency} ${Number(order.subtotal).toFixed(2)}</td></tr>
    ${order.delivery_fee ? `<tr><td style="padding:4px 0;font-size:14px;color:hsl(0,0%,45%);">Delivery Fee</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,45%);">${currency} ${Number(order.delivery_fee).toFixed(2)}</td></tr>` : ''}
    ${order.tax ? `<tr><td style="padding:4px 0;font-size:14px;color:hsl(0,0%,45%);">Tax</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,45%);">${currency} ${Number(order.tax).toFixed(2)}</td></tr>` : ''}
    ${order.tip ? `<tr><td style="padding:4px 0;font-size:14px;color:hsl(0,0%,45%);">Tip</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,45%);">${currency} ${Number(order.tip).toFixed(2)}</td></tr>` : ''}
    <tr><td style="padding:8px 0;font-size:16px;font-weight:bold;color:hsl(0,0%,17%);border-top:2px solid hsl(43,48%,58%);">Total</td><td style="text-align:right;padding:8px 0;font-size:16px;font-weight:bold;color:hsl(0,0%,17%);border-top:2px solid hsl(43,48%,58%);">${currency} ${Number(order.total).toFixed(2)}</td></tr>
  </table>

  ${branch ? `<p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 4px;"><strong>${branch.name}</strong></p><p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 20px;">${branch.address}, ${branch.city}</p>` : ''}
  
  <p style="font-size:12px;color:#999;margin:30px 0 0;">Thank you for ordering with ${tenantName}!</p>
</div>
</body></html>`;

    // Enqueue the email
    await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: recipientEmail,
        subject: `Order #${order.order_number} — Delivered!`,
        html,
        from_name: tenantName,
      },
    });

    // Log it
    await supabase.from('email_send_log').insert({
      template_name: 'order_delivered',
      recipient_email: recipientEmail,
      status: 'pending',
      metadata: { order_id, order_number: order.order_number },
    });

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
