import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const guestInfoSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').max(255),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
});

const cartItemSchema = z.object({
  id: z.string().uuid(),
  price: z.number().positive().max(100000),
  quantity: z.number().int().positive().max(100),
  special_instructions: z.string().max(500).optional(),
});

const requestBodySchema = z.object({
  order_type: z.enum(['delivery', 'pickup', 'dine_in']),
  delivery_address_id: z.string().uuid().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  guest_info: guestInfoSchema.optional().nullable(),
  guest_address: z.string().trim().max(500).optional().nullable(),
  guest_delivery_lat: z.number().min(-90).max(90).optional().nullable(),
  guest_delivery_lng: z.number().min(-180).max(180).optional().nullable(),
  items: z.array(cartItemSchema).min(1).max(50),
  cashback_used: z.number().nonnegative().max(100000).optional().default(0),
  special_instructions: z.string().trim().max(300).optional().nullable(),
  estimated_delivery_time: z.string().optional().nullable(),
  delivery_fee: z.number().nonnegative().max(100000).optional().default(0),
  tax: z.number().nonnegative().max(100000).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role to bypass RLS - this is a server-side function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Try to get user from auth header if present
    let user = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await anonClient.auth.getUser();
      user = data?.user;
    }

    const body = await req.json();
    
    // Validate request body
    const validationResult = requestBodySchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validationResult.error.errors }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // If auth header was provided but user couldn't be resolved, reject to prevent
    // signed-in orders from silently becoming guest orders
    if (authHeader && !user) {
      console.error('Auth header present but user could not be resolved — session may have expired');
      return new Response(
        JSON.stringify({ error: 'Authentication session expired. Please sign in again.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    let { order_type, delivery_address_id, branch_id, guest_info, guest_address, guest_delivery_lat, guest_delivery_lng, items, cashback_used, special_instructions, estimated_delivery_time, delivery_fee: clientDeliveryFee, tax: clientTax } = validationResult.data;

    console.log('Creating cash order for:', user ? `user ${user.id}` : `guest ${guest_info?.email}`);

    // Ensure profile exists for authenticated users (prevents FK violation)
    if (user?.id) {
      const { data: existingProfile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!existingProfile) {
        console.log('Profile missing for user, creating one...');
        await supabaseClient.from('profiles').insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || '',
        });
      }
    }

    // Reverse-geocode if address is generic and we have coordinates
    if (guest_delivery_lat && guest_delivery_lng && (!guest_address || guest_address === 'Pinned location' || guest_address === 'Current location')) {
      try {
        const googleMapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
        if (googleMapsKey) {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${guest_delivery_lat},${guest_delivery_lng}&key=${googleMapsKey}`;
          const geoRes = await fetch(geocodeUrl);
          const geoData = await geoRes.json();
          if (geoData.status === 'OK' && geoData.results?.[0]) {
            guest_address = geoData.results[0].formatted_address;
          }
        }
      } catch (e) { console.error('Reverse geocode failed:', e); }
    }

    // Guest checkout validation
    if (!user && !guest_info) {
      return new Response(
        JSON.stringify({ error: 'Guest information is required for checkout.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Items already validated by schema

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0
    );
    const tax = clientTax !== undefined ? clientTax : subtotal * 0.1;
    const deliveryFee = order_type === 'delivery' ? clientDeliveryFee : 0;
    const serviceFee = subtotal * 0.05; // 5% service fee
    const totalBeforeDiscount = subtotal + tax + deliveryFee + serviceFee;
    const cashbackDiscount = Math.min(cashback_used, totalBeforeDiscount);
    const total = totalBeforeDiscount - cashbackDiscount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: user?.id || null,
        guest_name: guest_info?.name || null,
        guest_email: guest_info?.email || null,
        guest_phone: guest_info?.phone || null,
        guest_delivery_address: guest_address || null,
        guest_delivery_lat: guest_delivery_lat || null,
        guest_delivery_lng: guest_delivery_lng || null,
        branch_id,
        order_type,
        delivery_address_id,
        order_number: orderNumber,
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        total,
        status: 'pending',
        cashback_used: cashbackDiscount,
        special_instructions: special_instructions || null,
        estimated_delivery_time: estimated_delivery_time || null,
      } as any)
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw orderError;
    }

    console.log('Order created:', order.id);

    // Deduct cashback from user's balance if used
    if (user?.id && cashbackDiscount > 0) {
      const { error: cashbackError } = await supabaseClient.rpc('deduct_cashback', {
        p_user_id: user.id,
        p_amount: cashbackDiscount,
      });
      
      if (cashbackError) {
        console.error('Cashback deduction error:', cashbackError);
        // Don't fail the order, just log the error
      } else {
        console.log('Cashback deducted:', cashbackDiscount);
      }
    }

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      special_instructions: item.special_instructions || null,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      throw itemsError;
    }

    console.log('Order items created');

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: order.id,
        order_number: orderNumber,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
