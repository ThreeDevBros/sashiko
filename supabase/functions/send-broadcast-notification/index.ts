import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmV2 } from "../_shared/fcm-v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { notification_id } = await req.json();
    if (!notification_id) throw new Error('notification_id required');

    // Get the notification
    const { data: notification, error: notifError } = await supabase
      .from('broadcast_notifications')
      .select('*')
      .eq('id', notification_id)
      .single();

    if (notifError || !notification) throw new Error('Notification not found');

    // Get recipient user IDs (for email channel)
    let userIds: string[] = [];

    if (notification.recipient_filter === 'active') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo)
        .not('user_id', 'is', null);
      userIds = [...new Set((activeOrders || []).map((o: any) => o.user_id))];
    } else {
      const { data: profiles } = await supabase.from('profiles').select('id');
      userIds = (profiles || []).map((p: any) => p.id);
    }

    let sentCount = 0;
    const channel = notification.channel;

    // Get tenant name for from_name
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('tenant_name')
      .limit(1)
      .single();
    const tenantName = settings?.tenant_name || 'Sashiko Asian Fusion';

    // --- EMAIL via transactional email queue ---
    if (channel === 'email' || channel === 'both') {
      if (userIds.length > 0) {
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const emailMap = new Map(authUsers?.map((u: any) => [u.id, u.email]) || []);

        const emails = userIds
          .map((id: string) => emailMap.get(id))
          .filter((e: string | undefined): e is string => !!e);

        const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px 25px;">
  <img src="https://rfwqbzeutrfccaazvibc.supabase.co/storage/v1/object/public/restaurant-images/email%2Fsashiko-logo.png" width="120" alt="${tenantName}" style="margin-bottom:24px;" />
  <h1 style="font-size:22px;font-weight:bold;color:hsl(0,0%,17%);margin:0 0 20px;">${notification.title}</h1>
  <p style="font-size:14px;color:hsl(0,0%,45%);line-height:1.6;margin:0 0 20px;">${notification.message.replace(/\n/g, '<br>')}</p>
  <p style="font-size:12px;color:#999;margin:30px 0 0;">${tenantName}</p>
</div>
</body></html>`;

        for (const email of emails) {
          await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              to: email,
              subject: notification.title,
              html: emailHtml,
              from_name: tenantName,
            },
          });
          sentCount++;
        }
      }
    }

    // --- PUSH NOTIFICATIONS via FCM v2 ---
    if (channel === 'push' || channel === 'both') {
      // Get ALL device tokens — both authenticated users and guest devices
      let allTokens: string[] = [];

      if (notification.recipient_filter === 'active' && userIds.length > 0) {
        // For "active" filter: get tokens for active users + all guest tokens
        const { data: userTokens } = await supabase
          .from('push_device_tokens')
          .select('token')
          .in('user_id', userIds);
        const { data: guestTokens } = await supabase
          .from('push_device_tokens')
          .select('token')
          .is('user_id', null);
        allTokens = [
          ...(userTokens || []).map((d: any) => d.token),
          ...(guestTokens || []).map((d: any) => d.token),
        ];
      } else {
        // For "all" filter: get every device token
        const { data: deviceTokens } = await supabase
          .from('push_device_tokens')
          .select('token');
        allTokens = (deviceTokens || []).map((d: any) => d.token);
      }

      // Deduplicate
      const uniqueTokens = [...new Set(allTokens)];

      if (uniqueTokens.length > 0) {
        const messages = uniqueTokens.map((token: string) => ({
          token,
          title: notification.title,
          body: notification.message,
          data: {
            type: 'broadcast',
            notification_id: notification.id,
          },
        }));

        const pushSent = await sendFcmV2(messages);
        sentCount += pushSent;
      }
    }

    // Handle case where nothing was sent
    if (sentCount === 0 && userIds.length === 0) {
      await supabase
        .from('broadcast_notifications')
        .update({ status: 'sent', sent_count: 0, sent_at: new Date().toISOString() })
        .eq('id', notification_id);
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update notification status
    await supabase
      .from('broadcast_notifications')
      .update({
        status: 'sent',
        sent_count: sentCount,
        sent_at: new Date().toISOString(),
      })
      .eq('id', notification_id);

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Broadcast notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
