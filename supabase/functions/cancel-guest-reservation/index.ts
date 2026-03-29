import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id, email } = await req.json();

    if (!reservation_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing reservation_id or email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the reservation exists and email matches
    const { data: reservation, error: fetchError } = await supabase
      .from('table_reservations')
      .select('id, status, guest_email')
      .eq('id', reservation_id)
      .eq('guest_email', email)
      .single();

    if (fetchError || !reservation) {
      return new Response(
        JSON.stringify({ error: 'Reservation not found or email mismatch' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (reservation.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Only pending reservations can be cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('table_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
