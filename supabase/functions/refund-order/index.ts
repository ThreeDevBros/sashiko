import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  order_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id } = validation.data;

    // Look up the order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('stripe_payment_intent_id, user_id, payment_method')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', order_id, orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Authorization: admin, staff/manager, or the order owner
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'manager', 'staff']);

    const hasStaffRole = roles && roles.length > 0;
    const isOwner = order.user_id === user.id;

    if (!hasStaffRole && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Check if it's a cash order or no payment intent
    const paymentMethod = order.payment_method || (order.stripe_payment_intent_id ? 'card' : 'cash');
    if (paymentMethod === 'cash' || !order.stripe_payment_intent_id) {
      console.log('Cash order — no Stripe refund needed for:', order_id);
      return new Response(
        JSON.stringify({ success: true, refunded: false, reason: 'cash_order' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const piId = order.stripe_payment_intent_id;

    const paymentIntent = await stripe.paymentIntents.retrieve(piId);

    if (paymentIntent.status !== 'succeeded') {
      console.log('Payment intent not succeeded, cannot refund:', paymentIntent.status);
      return new Response(
        JSON.stringify({ success: true, refunded: false, reason: 'payment_not_succeeded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (paymentIntent.amount_received === 0 || (paymentIntent as any).amount_refunded === paymentIntent.amount_received) {
      console.log('Already fully refunded:', piId);
      return new Response(
        JSON.stringify({ success: true, refunded: false, reason: 'already_refunded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const refund = await stripe.refunds.create({ payment_intent: piId });
    console.log('Refund created:', refund.id, 'for order:', order_id);

    return new Response(
      JSON.stringify({ success: true, refunded: true, refund_id: refund.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error processing refund:', error);
    return new Response(
      JSON.stringify({ error: 'Refund failed.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
