import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const cartItemSchema = z.object({
  id: z.string().uuid(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Stripe secret key from secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe configuration not found');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Webhook event received:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log('Processing completed checkout:', session.id);

      const metadata = session.metadata;
      if (!metadata) {
        throw new Error('No metadata found in session');
      }

      // Validate metadata
      const metadataValidation = z.object({
        user_id: z.string().uuid(),
        branch_id: z.string().optional(),
        order_type: z.enum(['delivery', 'pickup', 'dine_in']),
        delivery_address_id: z.string().optional(),
        subtotal: z.string(),
        tax: z.string(),
        delivery_fee: z.string(),
        items: z.string(),
      }).safeParse(metadata);

      if (!metadataValidation.success) {
        console.error('Metadata validation error:', metadataValidation.error);
        throw new Error('Invalid metadata');
      }

      const items = JSON.parse(metadata.items);
      
      // Validate items
      const itemsValidation = z.array(cartItemSchema).safeParse(items);
      if (!itemsValidation.success) {
        console.error('Items validation error:', itemsValidation.error);
        throw new Error('Invalid items data');
      }
      
      // Generate order number
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
          total: session.amount_total! / 100, // Convert from cents
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
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
