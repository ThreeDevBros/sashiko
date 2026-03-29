import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const subject = isApproved ? 'Reservation Confirmed ✅' : 'Reservation Cancelled';
    const statusTitle = isApproved ? 'Your reservation is confirmed!' : 'Your reservation has been cancelled';
    const statusColor = isApproved ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)';

    const resDate = new Date(reservation.reservation_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:20px 25px;">
  <img src="https://rfwqbzeutrfccaazvibc.supabase.co/storage/v1/object/public/restaurant-images/email%2Fsashiko-logo.png" width="120" alt="${tenantName}" style="margin-bottom:24px;" />
  <h1 style="font-size:22px;font-weight:bold;color:hsl(0,0%,17%);margin:0 0 20px;">${statusTitle}</h1>
  
  <div style="background:hsl(43,30%,95%);border-radius:0.5rem;padding:20px;margin-bottom:24px;">
    <table style="width:100%;">
      <tr><td style="padding:6px 0;font-size:14px;color:hsl(0,0%,45%);">Date</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,17%);font-weight:600;">${resDate}</td></tr>
      <tr><td style="padding:6px 0;font-size:14px;color:hsl(0,0%,45%);">Time</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,17%);font-weight:600;">${reservation.start_time.slice(0, 5)} — ${reservation.end_time.slice(0, 5)}</td></tr>
      <tr><td style="padding:6px 0;font-size:14px;color:hsl(0,0%,45%);">Party Size</td><td style="text-align:right;font-size:14px;color:hsl(0,0%,17%);font-weight:600;">${reservation.party_size} ${reservation.party_size === 1 ? 'guest' : 'guests'}</td></tr>
      <tr><td style="padding:6px 0;font-size:14px;color:hsl(0,0%,45%);">Status</td><td style="text-align:right;font-size:14px;color:${statusColor};font-weight:600;">${isApproved ? 'Confirmed' : 'Cancelled'}</td></tr>
    </table>
  </div>

  ${reservation.special_requests ? `<p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 16px;"><strong>Special Requests:</strong> ${reservation.special_requests}</p>` : ''}
  ${reservation.admin_notes ? `<p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 16px;"><strong>Note from restaurant:</strong> ${reservation.admin_notes}</p>` : ''}

  ${branch ? `<p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 4px;"><strong>${branch.name}</strong></p><p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 4px;">${branch.address}, ${branch.city}</p><p style="font-size:13px;color:hsl(0,0%,45%);margin:0 0 20px;">${branch.phone}</p>` : ''}
  
  <p style="font-size:12px;color:#999;margin:30px 0 0;">${tenantName}</p>
</div>
</body></html>`;

    // Enqueue the email
    await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: recipientEmail,
        subject,
        html,
        from_name: tenantName,
      },
    });

    // Log it
    await supabase.from('email_send_log').insert({
      template_name: `reservation_${new_status}`,
      recipient_email: recipientEmail,
      status: 'pending',
      metadata: { reservation_id },
    });

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
