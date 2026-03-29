import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

const cartItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  price: z.number().positive().max(1000000),
  quantity: z.number().int().positive().max(100),
  image_url: z.string().url().optional(),
});

const requestSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
  branch_id: z.string().uuid().optional(),
  order_type: z.enum(['delivery', 'pickup', 'dine_in']),
  delivery_address_id: z.string().uuid().optional(),
  delivery_fee: z.number().nonnegative().max(100000).optional().default(0),
  currency: z.string().min(3).max(3).optional().default('usd'),
  tax: z.number().nonnegative().max(100000).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Please sign in to continue with checkout.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const body = await req.json();
    
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid cart information. Please refresh and try again.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { items, branch_id, order_type, delivery_address_id, delivery_fee: clientDeliveryFee, currency: requestCurrency, tax: clientTax } = validation.data;

    console.log('Creating checkout session for user:', user.id);
    console.log('Items:', items);

    // Get Stripe secret key from secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe configuration not found');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    console.log('Using Stripe API version: 2023-10-16');

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: CartItem) => 
      sum + (item.price * item.quantity), 0
    );
    const tax = clientTax !== undefined ? clientTax : subtotal * 0.1;
    const deliveryFee = order_type === 'delivery' ? clientDeliveryFee : 0;
    const total = subtotal + tax + deliveryFee;

    const stripeCurrency = requestCurrency.toLowerCase();

    // Create Stripe line items
    const line_items = items.map((item: CartItem) => ({
      price_data: {
        currency: stripeCurrency,
        product_data: {
          name: item.name,
          images: item.image_url ? [item.image_url] : [],
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add tax and delivery fee as separate line items if applicable
    if (tax > 0) {
      line_items.push({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: 'Tax',
            images: [],
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    if (deliveryFee > 0) {
      line_items.push({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: 'Delivery Fee',
            images: [],
          },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    const origin = req.headers.get('origin') || 'http://localhost:8080';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        branch_id: branch_id || '',
        order_type,
        delivery_address_id: delivery_address_id || '',
        subtotal: subtotal.toString(),
        tax: tax.toString(),
        delivery_fee: deliveryFee.toString(),
        items: JSON.stringify(items),
      },
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to start checkout. Please try again.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
