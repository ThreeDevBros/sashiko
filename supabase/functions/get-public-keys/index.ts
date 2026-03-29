import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { key_type } = await req.json();

    // Only allow public/publishable keys
    const allowedKeys: Record<string, string> = {
      'STRIPE_PUBLISHABLE_KEY': 'STRIPE_PUBLISHABLE_KEY',
      'GOOGLE_MAPS_API_KEY': 'GOOGLE_MAPS_API_KEY',
    };

    if (!key_type || !allowedKeys[key_type]) {
      return new Response(
        JSON.stringify({ error: 'Invalid key type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const value = Deno.env.get(allowedKeys[key_type]) || null;

    return new Response(
      JSON.stringify({ key: value }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve key' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
