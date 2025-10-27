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

    const {
      booking_config_id,
      candidate_name,
      candidate_email,
      candidate_phone,
      candidate_timezone,
      scheduled_start,
      scheduled_end,
      notes,
    } = await req.json();

    console.log('[create-booking] Creating booking for:', candidate_email);

    // Load booking config
    const { data: config, error: configError } = await supabase
      .from('booking_configurations')
      .select('*')
      .eq('id', booking_config_id)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('[create-booking] Config error:', configError);
      return new Response(JSON.stringify({
        error: 'Booking configuration not found',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch profile separately
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', config.user_id)
      .single();

    if (profileError || !profile) {
      console.error('[create-booking] Profile error:', profileError);
      return new Response(JSON.stringify({
        error: 'Interviewer profile not found',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if slot is still available
    const { data: conflictingBookings } = await supabase
      .from('scheduled_bookings')
      .select('id')
      .eq('booking_config_id', booking_config_id)
      .eq('status', 'confirmed')
      .gte('scheduled_end', scheduled_start)
      .lte('scheduled_start', scheduled_end)
      .limit(1);

    if (conflictingBookings && conflictingBookings.length > 0) {
      return new Response(JSON.stringify({
        error: 'This time slot is no longer available. Please select another time.',
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Google Calendar event
    let googleEventId = null;
    let googleMeetLink = null;

    try {
      // Fetch calendar identity with access token
      const { data: calendarIdentity } = await supabase
        .from('calendar_identities')
        .select('access_token, token_expires_at')
        .eq('user_id', config.user_id)
        .eq('is_active', true)
        .single();

      if (calendarIdentity) {
        // Create event via Google Calendar API
        const eventResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${calendarIdentity.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `Interview with ${candidate_name}`,
            description: notes || `Interview scheduled via Virgilio booking link`,
            start: {
              dateTime: scheduled_start,
              timeZone: candidate_timezone,
            },
            end: {
              dateTime: scheduled_end,
              timeZone: candidate_timezone,
            },
            attendees: [
              { email: candidate_email },
              { email: profile.email },
            ],
            conferenceData: {
              createRequest: {
                requestId: `booking-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 },
              ],
            },
          }),
        });

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          googleEventId = eventData.id;
          googleMeetLink = eventData.hangoutLink;
          console.log('[create-booking] Google Calendar event created:', googleEventId);
        } else {
          const errorText = await eventResponse.text();
          console.warn('[create-booking] Failed to create Google Calendar event:', errorText);
        }
      }
    } catch (error) {
      console.warn('[create-booking] Google Calendar integration failed:', error);
    }

    // Insert booking
    const { data: booking, error: insertError } = await supabase
      .from('scheduled_bookings')
      .insert({
        booking_config_id,
        candidate_name,
        candidate_email,
        candidate_phone,
        candidate_timezone,
        scheduled_start,
        scheduled_end,
        notes,
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
        status: 'confirmed',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('[create-booking] Booking created successfully:', booking.id);

    return new Response(JSON.stringify({
      success: true,
      booking,
      meet_link: googleMeetLink,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[create-booking] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
