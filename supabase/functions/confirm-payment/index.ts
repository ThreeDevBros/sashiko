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

    // Get Stripe API key from secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured. Please contact support.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    const body = await req.json();
    
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid payment information. Please try again.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    let { payment_intent_id, guest_address, guest_delivery_lat, guest_delivery_lng, item_instructions } = validation.data;
    console.log('Confirming payment for intent:', payment_intent_id);

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

    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      console.error('Payment not completed, status:', paymentIntent.status);
      return new Response(
        JSON.stringify({ error: 'Payment was not completed. Please try again.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Parse metadata
    const metadata = paymentIntent.metadata;
    const items = JSON.parse(metadata.items || '[]');

    // Save billing address if provided
    if (paymentIntent.charges?.data?.[0]?.billing_details?.address) {
      const billingAddress = paymentIntent.charges.data[0].billing_details.address;
      const billingName = paymentIntent.charges.data[0].billing_details.name;
      
      if (billingAddress.line1 && billingAddress.city) {
        // Check if address already exists
        const { data: existingAddress } = await supabaseClient
          .from('user_addresses')
          .select('id')
          .eq('user_id', metadata.user_id)
          .eq('address_line1', billingAddress.line1)
          .eq('city', billingAddress.city)
          .single();

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

    // Check if order already exists
    const { data: existingOrders } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('id', payment_intent_id)
      .single();

    if (existingOrders) {
      console.log('Order already exists:', payment_intent_id);
      return new Response(
        JSON.stringify({ success: true, order_id: payment_intent_id }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    // Parse guest info from metadata if present
    let guestInfo = null;
    if (metadata.guest_info) {
      try {
        guestInfo = JSON.parse(metadata.guest_info);
      } catch (e) {
        console.log('Could not parse guest info');
      }
    }

    // Determine if this is a guest order
    const isGuestOrder = !metadata.user_id && guestInfo;

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        id: payment_intent_id,
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
        // Guest fields
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

    // Create order items - use item_instructions from request body since Stripe metadata can't hold them
    const instructionsMap = new Map((item_instructions || []).map((i: any) => [i.id, i.special_instructions]));
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity || item.qty,
      unit_price: item.price,
      total_price: item.price * (item.quantity || item.qty),
      special_instructions: instructionsMap.get(item.id) || item.special_instructions || null,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      throw itemsError;
    }

    console.log('Order created successfully:', order.id);

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
  } catch (error) {
    console.error('Error confirming payment:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process your order. Please contact support if the issue persists.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
