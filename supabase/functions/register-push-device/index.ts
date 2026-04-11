import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const requestSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.string().trim().min(1).max(20).default('unknown'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Invalid token payload', details: validation.error.errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Backend configuration is missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');

    if (authHeader) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data, error } = await authClient.auth.getUser();
      if (!error && data.user) {
        userId = data.user.id;
      }
    }

    const payload: Record<string, string> & { user_id?: string } = {
      token: validation.data.token,
      platform: validation.data.platform,
      updated_at: new Date().toISOString(),
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { error } = await serviceClient
      .from('push_device_tokens')
      .upsert(payload, { onConflict: 'token' });

    if (error) {
      console.error('register-push-device error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, linked_to_user: Boolean(userId) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('register-push-device fatal error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});