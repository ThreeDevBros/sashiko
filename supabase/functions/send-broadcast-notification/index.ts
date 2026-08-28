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

    // --- EMAIL via Lovable managed email ---
    if (channel === 'email' || channel === 'both') {
      if (userIds.length > 0) {
        const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const emailMap = new Map(authUsers?.map((u: any) => [u.id, u.email]) || []);

        const emails = userIds
          .map((id: string) => emailMap.get(id))
          .filter((e: string | undefined): e is string => !!e);

        const logSend = async (recipient: string, status: string, errorMessage?: string) => {
          const { error: logError } = await supabase.from('email_send_log').insert({
            template_name: 'broadcast',
            recipient_email: recipient,
            status,
            error_message: errorMessage,
            metadata: { notification_id },
          });
          if (logError) console.error('Failed to write email_send_log row', logError);
        };

        for (const email of emails) {
          try {
            const result = await sendTemplateEmail('broadcast-announcement', email, {
              templateData: {
                tenantName,
                title: notification.title,
                message: notification.message,
              },
              idempotencyKey: `broadcast-announcement-${notification_id}-${email}`,
            });

            if (!result.sent) {
              await logSend(email, 'suppressed');
              continue;
            }

            await logSend(email, 'sent');
            sentCount++;
          } catch (sendError: any) {
            // Rate limited: wait the requested cooldown, then retry once.
            if (sendError?.status === 429) {
              const waitSeconds = sendError?.retryAfterSeconds ?? 60;
              await new Promise((r) => setTimeout(r, waitSeconds * 1000));
              try {
                const retry = await sendTemplateEmail('broadcast-announcement', email, {
                  templateData: {
                    tenantName,
                    title: notification.title,
                    message: notification.message,
                  },
                  idempotencyKey: `broadcast-announcement-${notification_id}-${email}`,
                });
                if (retry.sent) {
                  await logSend(email, 'sent');
                  sentCount++;
                } else {
                  await logSend(email, 'suppressed');
                }
                continue;
              } catch (retryError: any) {
                await logSend(email, 'failed', String(retryError?.message ?? retryError).slice(0, 1000));
                continue;
              }
            }

            await logSend(email, 'failed', String(sendError?.message ?? sendError).slice(0, 1000));
          }
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

        const pushResult = await sendFcmV2(messages);
        sentCount += pushResult.sent;

        console.log(`[Broadcast] Push results:`, JSON.stringify(pushResult));
      }
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
