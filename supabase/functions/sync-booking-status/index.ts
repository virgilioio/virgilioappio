import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { booking_id } = await req.json();

    console.log('[sync-booking-status] Syncing booking:', booking_id);

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from('scheduled_bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (!booking.google_event_id) {
      throw new Error('No Google Calendar event linked to this booking');
    }

    // Fetch calendar identity
    const { data: calIdentity, error: calError } = await supabase
      .from('calendar_identities')
      .select('*')
      .eq('user_id', booking.interviewer_id)
      .eq('is_active', true)
      .single();

    if (calError || !calIdentity) {
      throw new Error('Calendar identity not found');
    }

    // Token refresh logic
    let accessToken = calIdentity.access_token;
    const now = new Date();
    const expiresAt = new Date(calIdentity.token_expires_at);

    if (expiresAt <= now) {
      const { data: decryptedToken } = await supabase.rpc(
        'decrypt_refresh_token',
        { encrypted_token: calIdentity.encrypted_refresh_token }
      );

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: decryptedToken,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await tokenResponse.json();
      accessToken = refreshData.access_token;
    }

    // Fetch event from Google
    const eventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!eventResponse.ok) {
      throw new Error('Failed to fetch event from Google Calendar');
    }

    const eventData = await eventResponse.json();

    // Find interviewer's response
    const interviewerAttendee = eventData.attendees?.find(
      (a: any) => a.email.toLowerCase() === calIdentity.email_address.toLowerCase()
    );

    if (!interviewerAttendee) {
      throw new Error('Interviewer not found in event attendees');
    }

    // Map status
    let newStatus = 'pending';
    if (interviewerAttendee.responseStatus === 'accepted') {
      newStatus = 'confirmed';
    } else if (interviewerAttendee.responseStatus === 'declined') {
      newStatus = 'declined';
    }

    // Update booking
    const updateData: any = {
      interviewer_confirmation_status: newStatus,
    };

    if (newStatus === 'confirmed') {
      updateData.interviewer_confirmed_at = new Date().toISOString();
    }

    await supabase
      .from('scheduled_bookings')
      .update(updateData)
      .eq('id', booking_id);

    console.log('[sync-booking-status] Status updated to:', newStatus);

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        response_status: interviewerAttendee.responseStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[sync-booking-status] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
