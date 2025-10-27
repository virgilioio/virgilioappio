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

    // Fetch and refresh calendar token if needed
    let accessToken: string | null = null;
    let calendarIdentity: any = null;
    
    const { data: calIdentity } = await supabase
      .from('calendar_identities')
      .select('*')
      .eq('user_id', config.user_id)
      .eq('is_active', true)
      .single();

    if (calIdentity) {
      calendarIdentity = calIdentity;
      
      // Check if access token is expired and refresh if needed
      const now = new Date();
      const expiresAt = new Date(calendarIdentity.token_expires_at);
      accessToken = calendarIdentity.access_token;

      if (expiresAt <= now) {
        console.log('[create-booking] Access token expired, refreshing...');

        // Decrypt refresh token
        const { data: decryptedToken, error: decryptError } = await supabase.rpc('decrypt_refresh_token', {
          encrypted_token: calendarIdentity.encrypted_refresh_token,
        });

        if (decryptError || !decryptedToken) {
          console.error('[create-booking] Failed to decrypt refresh token:', decryptError);
          
          await supabase
            .from('calendar_identities')
            .update({ sync_status: 'expired', sync_error_message: 'Failed to refresh token' })
            .eq('id', calendarIdentity.id);

          // Continue without calendar integration
          accessToken = null;
          console.warn('[create-booking] Proceeding without calendar integration');
        } else {
          // Refresh the access token via Google OAuth
          const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
          const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

          const tokenRefreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: decryptedToken,
              grant_type: 'refresh_token',
            }),
          });

          if (!tokenRefreshResponse.ok) {
            console.error('[create-booking] Token refresh failed:', await tokenRefreshResponse.text());
            
            await supabase
              .from('calendar_identities')
              .update({ sync_status: 'expired', sync_error_message: 'Token refresh failed' })
              .eq('id', calendarIdentity.id);

            accessToken = null;
            console.warn('[create-booking] Proceeding without calendar integration');
          } else {
            const refreshData = await tokenRefreshResponse.json();
            accessToken = refreshData.access_token;

            // Update calendar identity with new access token
            await supabase
              .from('calendar_identities')
              .update({
                access_token: accessToken,
                token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                sync_status: 'healthy',
                sync_error_message: null,
              })
              .eq('id', calendarIdentity.id);

            console.log('[create-booking] Token refreshed successfully');
          }
        }
      }
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

    if (accessToken && calendarIdentity) {
      try {
        console.log('[create-booking] Creating Google Calendar event...');

        const eventResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary: `Interview with ${candidate_name}`,
              description: `Interview scheduled via Virgilio booking system.\n\nCandidate: ${candidate_name}\nEmail: ${candidate_email}${notes ? '\n\nNotes: ' + notes : ''}`,
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
                  requestId: crypto.randomUUID(),
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
          }
        );

        if (!eventResponse.ok) {
          const errorText = await eventResponse.text();
          console.error('[create-booking] Google Calendar API error:', eventResponse.status, errorText);
          
          await supabase
            .from('calendar_identities')
            .update({ 
              sync_status: 'error', 
              sync_error_message: `Calendar event creation failed: ${eventResponse.status}`,
            })
            .eq('id', calendarIdentity.id);

          console.warn('[create-booking] Proceeding with booking creation without calendar event');
        } else {
          const eventData = await eventResponse.json();
          googleEventId = eventData.id;
          googleMeetLink = eventData.hangoutLink || eventData.conferenceData?.entryPoints?.[0]?.uri || null;
          
          console.log('[create-booking] Calendar event created successfully:', googleEventId);
          
          await supabase
            .from('calendar_identities')
            .update({ 
              sync_status: 'healthy',
              sync_error_message: null,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', calendarIdentity.id);
        }
      } catch (error) {
        console.error('[create-booking] Google Calendar integration error:', error);
      }
    } else {
      console.log('[create-booking] No calendar integration available, proceeding without calendar event');
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
      booking_id: booking.id,
      google_event_created: !!googleEventId,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
      warning: googleEventId ? null : 'Booking created but calendar event could not be created',
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
