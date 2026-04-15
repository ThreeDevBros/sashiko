import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  order_id: z.string().uuid(),
  guest_email: z.string().email(),
  cancellation_reason: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { order_id, guest_email, cancellation_reason } = validation.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch order and verify guest email matches
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, guest_email, user_id, stripe_payment_intent_id, payment_method')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Must be a guest order with matching email
    if (order.user_id || !order.guest_email) {
      return new Response(
        JSON.stringify({ error: 'Not a guest order.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (order.guest_email.toLowerCase() !== guest_email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Email mismatch.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (order.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Only pending orders can be cancelled.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Update order status to cancelled
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancellation_reason: cancellation_reason || 'Cancelled by customer',
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order status:', updateError);
      throw updateError;
    }

    // Process Stripe refund if applicable
    let refunded = false;
    let refund_id: string | null = null;

    const paymentMethod = order.payment_method || (order.stripe_payment_intent_id ? 'card' : 'cash');
    if (paymentMethod !== 'cash' && order.stripe_payment_intent_id) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
          const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);

          if (pi.status === 'succeeded' && pi.amount_received > 0) {
            const alreadyRefunded = (pi as any).amount_refunded === pi.amount_received;
            if (!alreadyRefunded) {
              const refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
              refunded = true;
              refund_id = refund.id;
              console.log('Refund created:', refund.id, 'for guest order:', order_id);
            } else {
              console.log('Already fully refunded:', order.stripe_payment_intent_id);
            }
          }
        } catch (stripeErr) {
          console.error('Stripe refund error for guest order:', stripeErr);
          // Order is already cancelled — don't fail the whole request
        }
      } else {
        console.error('STRIPE_SECRET_KEY not configured');
      }
    }

    return new Response(
      JSON.stringify({ success: true, refunded, refund_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling guest order:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to cancel order.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
