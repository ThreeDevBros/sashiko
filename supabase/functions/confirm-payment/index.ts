import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  payment_intent_id: z.string().min(1).max(500),
  guest_address: z.string().max(500).optional().nullable(),
  guest_delivery_lat: z.number().min(-90).max(90).optional().nullable(),
  guest_delivery_lng: z.number().min(-180).max(180).optional().nullable(),
  item_instructions: z.array(z.object({
    id: z.string().uuid(),
    special_instructions: z.string().max(200).optional().nullable(),
  })).optional().nullable(),
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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured. Please contact support.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid payment information. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let { payment_intent_id, guest_address, guest_delivery_lat, guest_delivery_lng, item_instructions } = validation.data;
    console.log('Confirming payment for intent:', payment_intent_id);

    // Check if order already exists (dedup by stripe_payment_intent_id)
    const { data: existingOrder } = await supabaseClient
      .from('orders')
      .select('id, order_number')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .maybeSingle();

    if (existingOrder) {
      console.log('Order already exists for PI:', payment_intent_id);
      return new Response(
        JSON.stringify({ success: true, order_id: existingOrder.id, order_number: existingOrder.order_number }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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

    // Retrieve the payment intent with retry for Apple Pay timing
    let paymentIntent: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
      if (paymentIntent.status === 'succeeded') break;
      if (attempt < 2) {
        console.log(`Payment not yet succeeded (${paymentIntent.status}), retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (paymentIntent.status !== 'succeeded') {
      console.error('Payment not completed after retries, status:', paymentIntent.status);
      return new Response(
        JSON.stringify({ error: 'Payment was not completed. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse metadata
    const metadata = paymentIntent.metadata;
    let items: any[] = [];
    try {
      const parsed = JSON.parse(metadata.items || '[]');
      // Handle truncated metadata (stored as { count, total } instead of array)
      if (Array.isArray(parsed)) {
        items = parsed;
      } else {
        console.warn('Items metadata was truncated, order items will be empty:', parsed);
        items = [];
      }
    } catch (e) {
      console.warn('Failed to parse items metadata:', e);
      items = [];
    }

    // Parse guest info from metadata if present
    let guestInfo = null;
    if (metadata.guest_info) {
      try { guestInfo = JSON.parse(metadata.guest_info); } catch (e) { console.log('Could not parse guest info'); }
    }

    const isGuestOrder = !metadata.user_id && guestInfo;
    const orderNumber = `ORD-${Date.now()}`;

    // Create order — let DB auto-generate UUID, store stripe PI for dedup
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        stripe_payment_intent_id: payment_intent_id,
        payment_method: 'card',
        user_id: metadata.user_id || null,
        branch_id: metadata.branch_id || null,
        order_type: metadata.order_type,
        delivery_address_id: metadata.delivery_address_id || null,
        subtotal: parseFloat(metadata.subtotal),
        tax: parseFloat(metadata.tax),
        delivery_fee: parseFloat(metadata.delivery_fee),
        total: paymentIntent.amount / 100,
        status: 'pending',
        order_number: orderNumber,
        estimated_delivery_time: metadata.estimated_delivery_time || null,
        guest_name: isGuestOrder ? guestInfo.name : null,
        guest_email: isGuestOrder ? guestInfo.email : null,
        guest_phone: guestInfo?.phone || null,
        guest_delivery_address: guest_address || null,
        guest_delivery_lat: guest_delivery_lat || null,
        guest_delivery_lng: guest_delivery_lng || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    // Create order items (skip if metadata was truncated)
    if (items.length > 0) {
      const instructionsMap = new Map((item_instructions || []).map((i: any) => [i.id, i.special_instructions]));
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.id,
        quantity: item.quantity || item.qty,
        unit_price: item.price,
        total_price: item.price * (item.quantity || item.qty),
        special_instructions: instructionsMap.get(item.id) || item.special_instructions || null,
      }));

      const { error: itemsError } = await supabaseClient.from('order_items').insert(orderItems);
      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        throw itemsError;
      }
    }

    // Save billing address if provided
    if (metadata.user_id && paymentIntent.charges?.data?.[0]?.billing_details?.address) {
      const billingAddress = paymentIntent.charges.data[0].billing_details.address;
      const billingName = paymentIntent.charges.data[0].billing_details.name;
      if (billingAddress.line1 && billingAddress.city) {
        const { data: existingAddress } = await supabaseClient
          .from('user_addresses')
          .select('id')
          .eq('user_id', metadata.user_id)
          .eq('address_line1', billingAddress.line1)
          .eq('city', billingAddress.city)
          .maybeSingle();

        if (!existingAddress) {
          await supabaseClient.from('user_addresses').insert({
            user_id: metadata.user_id,
            label: billingName || 'Billing Address',
            address_line1: billingAddress.line1,
            address_line2: billingAddress.line2,
            city: billingAddress.city,
            postal_code: billingAddress.postal_code,
          });
        }
      }
    }

    console.log('Order created successfully:', order.id);

    return new Response(
      JSON.stringify({ success: true, order_id: order.id, order_number: orderNumber }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error confirming payment:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process your order. Please contact support if the issue persists.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
