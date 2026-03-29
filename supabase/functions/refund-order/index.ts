import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  order_id: z.string().min(1).max(500),
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

    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id } = validation.data;

    // The order_id IS the payment_intent_id for card orders (set in confirm-payment)
    // For cash orders, it's a regular UUID — skip refund
    const isPaymentIntent = order_id.startsWith('pi_');

    if (!isPaymentIntent) {
      console.log('Cash order — no Stripe refund needed for:', order_id);
      return new Response(
        JSON.stringify({ success: true, refunded: false, reason: 'cash_order' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get Stripe API key from secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Retrieve the payment intent to check status
    const paymentIntent = await stripe.paymentIntents.retrieve(order_id);

    if (paymentIntent.status !== 'succeeded') {
      console.log('Payment intent not succeeded, cannot refund:', paymentIntent.status);
      return new Response(
        JSON.stringify({ success: true, refunded: false, reason: 'payment_not_succeeded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if already refunded
    if (paymentIntent.amount_received === 0 || (paymentIntent as any).amount_refunded === paymentIntent.amount_received) {
      console.log('Already fully refunded:', order_id);
      return new Response(
        JSON.stringify({ success: true, refunded: false, reason: 'already_refunded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Issue full refund
    const refund = await stripe.refunds.create({
      payment_intent: order_id,
    });

    console.log('Refund created:', refund.id, 'for order:', order_id);

    return new Response(
      JSON.stringify({ success: true, refunded: true, refund_id: refund.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error processing refund:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Refund failed: ${message}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
