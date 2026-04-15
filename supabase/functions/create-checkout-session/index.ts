import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

/** Fetch authoritative prices from DB and compute subtotal server-side */
async function getVerifiedPrices(
  supabaseAdmin: any,
  items: { id: string; quantity: number }[],
  branchId: string | undefined,
) {
  const ids = items.map(i => i.id);

  const { data: dbItems, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, price, name')
    .in('id', ids);

  if (error || !dbItems) {
    throw new Error('Failed to verify item prices.');
  }

  const priceMap = new Map<string, { price: number; name: string }>();
  for (const item of dbItems) {
    priceMap.set(item.id, { price: Number(item.price), name: item.name });
  }

  if (branchId) {
    const { data: branchItems } = await supabaseAdmin
      .from('branch_menu_items')
      .select('menu_item_id, price_override')
      .eq('branch_id', branchId)
      .in('menu_item_id', ids)
      .not('price_override', 'is', null);

    if (branchItems) {
      for (const bi of branchItems) {
        const existing = priceMap.get(bi.menu_item_id);
        if (existing) {
          priceMap.set(bi.menu_item_id, { ...existing, price: Number(bi.price_override) });
        }
      }
    }
  }

  for (const item of items) {
    if (!priceMap.has(item.id)) {
      throw new Error(`Menu item not found: ${item.id}`);
    }
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + priceMap.get(item.id)!.price * item.quantity;
  }, 0);

  return { priceMap, subtotal };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const body = await req.json();
    
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid cart information. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { items, branch_id, order_type, delivery_address_id, delivery_fee: clientDeliveryFee, currency: requestCurrency, tax: clientTax } = validation.data;

    console.log('Creating checkout session for user:', user.id);

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe configuration not found');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // SERVER-SIDE PRICE VERIFICATION
    const { priceMap, subtotal } = await getVerifiedPrices(supabaseAdmin, items, branch_id);

    const tax = clientTax !== undefined ? clientTax : subtotal * 0.1;
    const deliveryFee = order_type === 'delivery' ? clientDeliveryFee : 0;
    const total = subtotal + tax + deliveryFee;

    const stripeCurrency = requestCurrency.toLowerCase();

    // Create Stripe line items using verified prices
    const line_items = items.map((item) => ({
      price_data: {
        currency: stripeCurrency,
        product_data: {
          name: priceMap.get(item.id)?.name || item.name,
          images: item.image_url ? [item.image_url] : [],
        },
        unit_amount: Math.round((priceMap.get(item.id)?.price ?? 0) * 100),
      },
      quantity: item.quantity,
    }));

    if (tax > 0) {
      line_items.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: 'Tax', images: [] },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    if (deliveryFee > 0) {
      line_items.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: 'Delivery Fee', images: [] },
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to start checkout. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
