import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const guestInfoSchema = z.object({
  name: z.string().trim().max(100).optional().default(''),
  email: z.string().trim().max(255).optional().default(''),
  phone: z.string().trim().max(20).optional().default(''),
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

/** Fetch authoritative prices from DB and compute subtotal server-side */
async function getVerifiedPrices(
  supabaseClient: any,
  items: { id: string; quantity: number }[],
  branchId: string | null | undefined,
) {
  const ids = items.map(i => i.id);

  const { data: dbItems, error } = await supabaseClient
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
    const { data: branchItems } = await supabaseClient
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
    
    const validationResult = requestBodySchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validationResult.error.errors }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (authHeader && !user) {
      console.error('Auth header present but user could not be resolved — session may have expired');
      return new Response(
        JSON.stringify({ error: 'Authentication session expired. Please sign in again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    let { order_type, delivery_address_id, branch_id, guest_info, guest_address, guest_delivery_lat, guest_delivery_lng, items, cashback_used, special_instructions, estimated_delivery_time, delivery_fee: clientDeliveryFee, tax: clientTax } = validationResult.data;

    console.log('Creating cash order for:', user ? `user ${user.id}` : `guest ${guest_info?.email}`);

    // Ensure profile exists for authenticated users
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

    // For authenticated users, populate guest_name/email/phone from profile
    if (user?.id) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      const profileName = profile?.full_name || guest_info?.name || user.user_metadata?.full_name || '';
      const profilePhone = profile?.phone || guest_info?.phone || '';
      const profileEmail = guest_info?.email || user.email || '';

      guest_info = {
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
      };
    }

    // Guest checkout validation
    if (!user) {
      if (!guest_info || !guest_info.name || guest_info.name.length < 2) {
        return new Response(
          JSON.stringify({ error: 'Full name is required (at least 2 characters).' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      if (!guest_info.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_info.email)) {
        return new Response(
          JSON.stringify({ error: 'A valid email address is required.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      if (!guest_info.phone || guest_info.phone.length < 1) {
        return new Response(
          JSON.stringify({ error: 'Phone number is required.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // SERVER-SIDE PRICE VERIFICATION: fetch authoritative prices from DB
    const { priceMap, subtotal } = await getVerifiedPrices(supabaseClient, items, branch_id);

    const tax = clientTax !== undefined ? clientTax : subtotal * 0.1;
    const deliveryFee = order_type === 'delivery' ? clientDeliveryFee : 0;
    const serviceFee = subtotal * 0.05;
    const totalBeforeDiscount = subtotal + tax + deliveryFee + serviceFee;
    const cashbackDiscount = Math.min(cashback_used, totalBeforeDiscount);
    const total = totalBeforeDiscount - cashbackDiscount;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

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

    if (user?.id && cashbackDiscount > 0) {
      const { error: cashbackError } = await supabaseClient.rpc('deduct_cashback', {
        p_user_id: user.id,
        p_amount: cashbackDiscount,
      });
      
      if (cashbackError) {
        console.error('Cashback deduction error:', cashbackError);
      } else {
        console.log('Cashback deducted:', cashbackDiscount);
      }
    }

    // Create order items using verified DB prices
    const orderItems = items.map((item: any) => {
      const dbPrice = priceMap.get(item.id)?.price ?? item.price;
      return {
        order_id: order.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: dbPrice,
        total_price: dbPrice * item.quantity,
        special_instructions: item.special_instructions || null,
      };
    });

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
