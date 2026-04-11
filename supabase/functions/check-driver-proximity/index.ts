import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmV2 } from "../_shared/fcm-v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { order_id, driver_lat, driver_lng } = await req.json();
    if (!order_id || driver_lat == null || driver_lng == null) {
      return new Response(JSON.stringify({ error: 'order_id, driver_lat, driver_lng required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already notified
    const { data: driverLoc } = await supabase
      .from('driver_locations')
      .select('proximity_notified')
      .eq('order_id', order_id)
      .single();

    if (driverLoc?.proximity_notified) {
      return new Response(JSON.stringify({ notified: false, reason: 'already_notified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the order's delivery address coordinates
    const { data: order } = await supabase
      .from('orders')
      .select('user_id, display_number, order_number, delivery_address_id, guest_delivery_lat, guest_delivery_lng')
      .eq('id', order_id)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ notified: false, reason: 'order_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let destLat: number | null = null;
    let destLng: number | null = null;

    // Try guest delivery coordinates first
    if (order.guest_delivery_lat && order.guest_delivery_lng) {
      destLat = order.guest_delivery_lat;
      destLng = order.guest_delivery_lng;
    } else if (order.delivery_address_id) {
      // Look up saved address
      const { data: addr } = await supabase
        .from('user_addresses')
        .select('latitude, longitude')
        .eq('id', order.delivery_address_id)
        .single();
      if (addr) {
        destLat = addr.latitude;
        destLng = addr.longitude;
      }
    }

    if (destLat == null || destLng == null) {
      return new Response(JSON.stringify({ notified: false, reason: 'no_delivery_coordinates' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const distance = haversineMeters(driver_lat, driver_lng, destLat, destLng);
    console.log(`[Proximity] Order ${order_id}: driver is ${distance.toFixed(1)}m from destination`);

    if (distance > 10) {
      return new Response(JSON.stringify({ notified: false, distance_m: Math.round(distance) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Within 10m — mark as notified
    await supabase
      .from('driver_locations')
      .update({ proximity_notified: true })
      .eq('order_id', order_id);

    // Send push to customer
    if (order.user_id) {
      const { data: tokens } = await supabase
        .from('push_device_tokens')
        .select('token')
        .eq('user_id', order.user_id);

      const orderLabel = order.display_number != null
        ? `#${String(order.display_number).padStart(3, '0')}`
        : `#${order.order_number.slice(-6)}`;

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: any) => ({
          token: t.token,
          title: `Order ${orderLabel}`,
          body: 'Your driver is arriving! 🚗',
          collapseKey: `order_${order_id}`,
          data: {
            type: 'driver_arriving',
            order_id,
          },
        }));
        await sendFcmV2(messages);
      }
    }

    return new Response(JSON.stringify({ notified: true, distance_m: Math.round(distance) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Check driver proximity error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
