import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole, STAFF_ROLES } from "../_shared/auth.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

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

    // Only staff/admin (or the assigned driver) may trigger customer notifications
    const authResult = await requireRole(req, supabase, STAFF_ROLES, corsHeaders);
    if ('response' in authResult) return authResult.response;

    const { reservation_id, new_status } = await req.json();
    if (!reservation_id || !new_status) throw new Error('reservation_id and new_status required');

    // Only send for approved or cancelled
    if (!['approved', 'cancelled'].includes(new_status)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'status not applicable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch reservation with branch info
    const { data: reservation, error: resError } = await supabase
      .from('table_reservations')
      .select('*, branches(name, address, city, phone)')
      .eq('id', reservation_id)
      .single();

    if (resError || !reservation) throw new Error('Reservation not found');

    // Get recipient email
    let recipientEmail: string | null = null;
    if (reservation.user_id) {
      const { data: { user } } = await supabase.auth.admin.getUserById(reservation.user_id);
      recipientEmail = user?.email || null;
    } else {
      recipientEmail = reservation.guest_email;
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('tenant_name')
      .limit(1)
      .single();

    const tenantName = settings?.tenant_name || 'Sashiko Asian Fusion';
    const branch = reservation.branches as any;

    const isApproved = new_status === 'approved';

    const resDate = new Date(reservation.reservation_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const templateData = {
      tenantName,
      approved: isApproved,
      reservationDate: resDate,
      startTime: String(reservation.start_time).slice(0, 5),
      endTime: String(reservation.end_time).slice(0, 5),
      partySize: reservation.party_size,
      specialRequests: reservation.special_requests || undefined,
      adminNotes: reservation.admin_notes || undefined,
      branchName: branch?.name,
      branchAddress: branch ? `${branch.address}, ${branch.city}` : undefined,
      branchPhone: branch?.phone,
    };

    const logSend = async (status: string, errorMessage?: string) => {
      const { error: logError } = await supabase.from('email_send_log').insert({
        template_name: `reservation_${new_status}`,
        recipient_email: recipientEmail,
        status,
        error_message: errorMessage,
        metadata: { reservation_id },
      });
      if (logError) console.error('Failed to write email_send_log row', logError);
    };

    try {
      const result = await sendTemplateEmail('reservation-status', recipientEmail, {
        templateData,
        idempotencyKey: `reservation-status-${reservation_id}-${new_status}`,
      });

      if (!result.sent) {
        await logSend('suppressed');
        return new Response(JSON.stringify({ skipped: true, reason: result.reason }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await logSend('sent');
    } catch (sendError: any) {
      await logSend('failed', String(sendError?.message ?? sendError).slice(0, 1000));
      throw sendError;
    }


    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('send-reservation-email error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
