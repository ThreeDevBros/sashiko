import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const googleToOurDay = (googleDay: number) => (googleDay === 0 ? 6 : googleDay - 1);

const formatTime = (time?: { hour?: number; minute?: number } | null) => {
  if (typeof time?.hour !== 'number') return null;
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute ?? 0).padStart(2, '0')}`;
};

const buildOpeningHours = (periods?: Array<any> | null) => {
  if (!Array.isArray(periods) || periods.length === 0) return null;

  const schedule = Array.from({ length: 7 }, (_, ourDay) => ({
    day_of_week: ourDay,
    is_closed: true,
    is_24h: false,
    open_time: null as string | null,
    close_time: null as string | null,
  }));

  for (const period of periods) {
    const open = period?.open;
    const close = period?.close;

    if (typeof open?.day !== 'number') continue;

    const ourDay = googleToOurDay(open.day);
    const is24h = open.hour === 0 && (open.minute ?? 0) === 0 && !close;

    if (is24h) {
      schedule[ourDay] = {
        day_of_week: ourDay,
        is_closed: false,
        is_24h: true,
        open_time: null,
        close_time: null,
      };
      continue;
    }

    const openTime = formatTime(open);
    let closeTime = formatTime(close);

    // Handle overnight hours: if close.day differs from open.day,
    // the business closes past midnight. Store the close time as-is
    // on the opening day (e.g. open 18:00, close 02:00).
    if (close && typeof close.day === 'number' && close.day !== open.day) {
      // Overnight closing — still record it on the opening day
      closeTime = formatTime(close);
      console.log(`[Hours] Overnight period: opens day ${open.day} at ${openTime}, closes day ${close.day} at ${closeTime}`);
    }

    schedule[ourDay] = {
      day_of_week: ourDay,
      is_closed: false,
      is_24h: false,
      open_time: openTime,
      close_time: closeTime,
    };
  }

  return schedule;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const { place_id, branch_id } = await req.json();

    if (!place_id) {
      throw new Error('place_id is required');
    }

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(place_id)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,regularOpeningHours.periods',
      },
    });

    const responseText = await response.text();
    let data: any = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const apiMessage = data?.error?.message || responseText || 'Unknown Google Places API error';
      throw new Error(`Google Places API error: ${apiMessage}`);
    }

    // Debug log raw periods for troubleshooting
    console.log(`[fetch-google-reviews] Raw periods:`, JSON.stringify(data?.regularOpeningHours?.periods));

    const result = {
      rating: data?.rating ?? null,
      review_count: data?.userRatingCount ?? null,
      name: data?.displayName?.text ?? null,
      opening_hours: buildOpeningHours(data?.regularOpeningHours?.periods),
    };

    if (branch_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { error: updateError } = await supabase
        .from('branches')
        .update({
          google_maps_rating: result.rating,
          google_maps_review_count: result.review_count,
          google_maps_place_id: place_id,
        })
        .eq('id', branch_id);

      if (updateError) {
        throw new Error(`Failed to update branch metadata: ${updateError.message}`);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
