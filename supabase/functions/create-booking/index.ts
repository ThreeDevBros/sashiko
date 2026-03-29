import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const bookingSchema = z.object({
  branch_id: z.string().uuid(),
  table_object_id: z.string().min(1).max(100),
  guest_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().min(1).max(20),
  party_size: z.number().int().positive().max(50),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  special_requests: z.string().max(1000).optional(),
  requires_table_combination: z.boolean().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Service role client for insert (bypasses RLS - data is validated in this function)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    const body = await req.json();
    
    const validation = bookingSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid booking information. Please check all fields are filled correctly.',
          details: validation.error.errors 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const bookingData = validation.data;

    // Duplicate prevention: Check for existing booking with same table, date, and time
    // This prevents double-booking the same table, not the same customer
    const { data: existingBooking } = await supabaseClient
      .from('table_reservations')
      .select('id, guest_email')
      .eq('table_object_id', bookingData.table_object_id)
      .eq('branch_id', bookingData.branch_id)
      .eq('reservation_date', bookingData.reservation_date)
      .eq('start_time', bookingData.start_time)
      .in('status', ['pending', 'confirmed', 'awaiting_arrangement'])
      .maybeSingle();

    if (existingBooking) {
      // Check if it's the same customer trying to book the same slot
      if (existingBooking.guest_email === bookingData.guest_email) {
        console.log(`Duplicate booking attempt for email: ${bookingData.guest_email} on ${bookingData.reservation_date} at ${bookingData.start_time}`);
        return new Response(
          JSON.stringify({ error: 'You already have a booking for this table at this date and time.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      } else {
        // Different customer, table is just not available
        return new Response(
          JSON.stringify({ error: 'This table is not available at the selected time. Please choose a different time or table.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      }
    }

    // Get configurable reservation duration from tenant settings
    const { data: settingsData } = await supabaseAdmin
      .from('tenant_settings')
      .select('reservation_duration_minutes')
      .limit(1)
      .maybeSingle();

    const durationMinutes = (settingsData as any)?.reservation_duration_minutes ?? 120;

    // Calculate end time based on configured duration
    const [hours, minutes] = bookingData.start_time.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);
    const end_time = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Validate date is not in the past
    const reservationDate = new Date(bookingData.reservation_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (reservationDate < today) {
      return new Response(
        JSON.stringify({ error: 'Cannot book a date in the past. Please select a future date.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Validate time is within branch working hours
    const { data: branchData, error: branchError } = await supabaseClient
      .from('branches')
      .select('opens_at, closes_at')
      .eq('id', bookingData.branch_id)
      .single();

    if (branchError || !branchData) {
      return new Response(
        JSON.stringify({ error: 'Branch not found.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Check if booking time is within working hours
    const [startHour, startMin] = bookingData.start_time.split(':').map(Number);
    const [openHour, openMin] = branchData.opens_at.split(':').map(Number);
    const [closeHour, closeMin] = branchData.closes_at.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    const isOutsideHours = closeMinutes <= openMinutes
      // Overnight hours (e.g. 08:00 - 00:00): valid if time >= open OR time < close
      ? (startMinutes < openMinutes && startMinutes >= closeMinutes)
      // Normal hours: valid if time >= open AND time < close
      : (startMinutes < openMinutes || startMinutes >= closeMinutes);

    if (isOutsideHours) {
      return new Response(
        JSON.stringify({ 
          error: `Please select a time within working hours (${branchData.opens_at} - ${branchData.closes_at}).` 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Create the booking
    const { data, error } = await supabaseAdmin
      .from('table_reservations')
      .insert({
        branch_id: bookingData.branch_id,
        table_object_id: bookingData.table_object_id,
        user_id: user?.id || null,
        guest_name: bookingData.guest_name,
        guest_email: bookingData.guest_email,
        guest_phone: bookingData.guest_phone,
        party_size: bookingData.party_size,
        reservation_date: bookingData.reservation_date,
        start_time: bookingData.start_time,
        end_time: end_time,
        special_requests: bookingData.special_requests || null,
        requires_table_combination: bookingData.requires_table_combination || false,
        status: bookingData.requires_table_combination ? 'awaiting_arrangement' : 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Booking created successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, booking: data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating booking:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Unable to create reservation: ${errorMessage}. Please try again or contact support.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
