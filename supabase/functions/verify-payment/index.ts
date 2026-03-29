import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { session_id } = await req.json();

    if (!session_id) {
      throw new Error('No session ID provided');
    }

    console.log('Verifying payment for session:', session_id);

    // Get Stripe secret key from secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe configuration not found');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log('Session status:', session.payment_status);

    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not completed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const metadata = session.metadata;
    if (!metadata) {
      throw new Error('No metadata found in session');
    }

    // Check if order already exists
    const { data: existingOrders } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('order_number', `ORD-${session_id.slice(-8)}`);

    if (existingOrders && existingOrders.length > 0) {
      console.log('Order already exists');
      return new Response(
        JSON.stringify({ success: true, message: 'Order already created', order_id: existingOrders[0].id }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const items = JSON.parse(metadata.items);
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: metadata.user_id,
        branch_id: metadata.branch_id || null,
        order_type: metadata.order_type,
        delivery_address_id: metadata.delivery_address_id || null,
        order_number: orderNumber,
        subtotal: parseFloat(metadata.subtotal),
        tax: parseFloat(metadata.tax),
        delivery_fee: parseFloat(metadata.delivery_fee),
        total: session.amount_total! / 100,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    console.log('Order created:', order.id);

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      throw itemsError;
    }

    console.log('Order items created successfully');

    return new Response(
      JSON.stringify({ success: true, order_id: order.id, order_number: orderNumber }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Verify payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
