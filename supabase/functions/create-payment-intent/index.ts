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
  price: z.number().nonnegative().max(100000000),
  quantity: z.number().int().positive().max(100),
  image_url: z.string().url().or(z.literal('')).nullable().optional(),
});

const guestInfoSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().min(1).max(50),
});

const requestSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
  branch_id: z.string().uuid().nullable().optional(),
  order_type: z.enum(['delivery', 'pickup', 'dine_in']),
  delivery_address_id: z.string().nullable().optional(),
  guest_info: guestInfoSchema.nullable().optional(),
  estimated_delivery_time: z.string().nullable().optional(),
  delivery_fee: z.number().nonnegative().max(100000).optional().default(0),
  service_fee: z.number().nonnegative().max(100000).optional().default(0),
  currency: z.string().min(3).max(3).optional().default('usd'),
  tax: z.number().nonnegative().max(100000).optional(),
  order_total: z.number().positive().max(100000000),
});

/** Fetch authoritative prices from DB and compute subtotal server-side */
async function getVerifiedPrices(
  supabaseAdmin: any,
  items: { id: string; quantity: number }[],
  branchId: string | null | undefined,
) {
  const ids = items.map(i => i.id);

  // Fetch base menu_item prices
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

  // Check for branch-specific price overrides
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

  // Verify all items exist
  for (const item of items) {
    if (!priceMap.has(item.id)) {
      throw new Error(`Menu item not found: ${item.id}`);
    }
  }

  const subtotal = items.reduce((sum, item) => {
    const dbPrice = priceMap.get(item.id)!.price;
    return sum + dbPrice * item.quantity;
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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

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

    const body = await req.json();
    
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid cart information. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { items, branch_id, order_type, delivery_address_id, guest_info, estimated_delivery_time, delivery_fee: clientDeliveryFee, service_fee: clientServiceFee, currency: requestCurrency, tax: clientTax, order_total } = validation.data;

    // Guest checkout validation
    if (!user && !guest_info) {
      return new Response(
        JSON.stringify({ error: 'Guest information is required for checkout.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Creating payment intent for:', user ? `user ${user.id}` : `guest ${guest_info?.email}`);

    // SERVER-SIDE PRICE VERIFICATION: fetch authoritative prices from DB for metadata/sanity check
    const { priceMap, subtotal } = await getVerifiedPrices(supabaseAdmin, items, branch_id);

    const tax = clientTax !== undefined ? clientTax : subtotal * 0.1;
    const deliveryFee = order_type === 'delivery' ? clientDeliveryFee : 0;
    const serviceFee = clientServiceFee;
    const serverTotal = subtotal + tax + deliveryFee + serviceFee;

    // Use the UI-computed order_total as the authoritative charge amount
    // Log a warning if it deviates significantly from server calculation (for debugging)
    if (Math.abs(order_total - serverTotal) > 1) {
      console.warn(`Price deviation detected: UI total=${order_total}, server total=${serverTotal}, subtotal=${subtotal}, tax=${tax}, deliveryFee=${deliveryFee}, serviceFee=${serviceFee}`);
    }

    // Check minimum amount (Stripe requires at least $0.50 USD)
    const minimumAmount = 0.50;
    if (order_total < minimumAmount) {
      console.error(`Total amount $${order_total} is below minimum $${minimumAmount}`);
      return new Response(
        JSON.stringify({ 
          error: `Order total must be at least $${minimumAmount.toFixed(2)}. Current total: $${order_total.toFixed(2)}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId: string | undefined;
    
    if (user?.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }
    } else if (guest_info?.email) {
      const customers = await stripe.customers.list({ email: guest_info.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: guest_info.email,
          name: guest_info.name,
          phone: guest_info.phone,
        });
        customerId = customer.id;
      }
    }

    // Create simplified items for metadata
    const itemsForMetadata = items.map(item => ({
      id: item.id,
      name: (priceMap.get(item.id)?.name || '').substring(0, 30),
      price: priceMap.get(item.id)?.price ?? 0,
      qty: item.quantity,
    }));
    
    let itemsMetadata = JSON.stringify(itemsForMetadata);
    if (itemsMetadata.length > 450) {
      itemsMetadata = JSON.stringify({ count: items.length, total: subtotal });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order_total * 100),
      currency: requestCurrency.toLowerCase(),
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      setup_future_usage: user ? 'off_session' : undefined,
      metadata: {
        user_id: user?.id || '',
        branch_id: branch_id || '',
        order_type,
        delivery_address_id: (delivery_address_id && delivery_address_id !== 'current-location') ? delivery_address_id : '',
        subtotal: subtotal.toString(),
        tax: tax.toString(),
        delivery_fee: deliveryFee.toString(),
        service_fee: serviceFee.toString(),
        items: itemsMetadata,
        guest_info: guest_info ? JSON.stringify({ name: guest_info.name, email: guest_info.email }) : '',
        estimated_delivery_time: estimated_delivery_time || '',
      },
      expand: ['latest_charge'],
    });

    console.log('Payment Intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        customerId: customerId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize payment. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
