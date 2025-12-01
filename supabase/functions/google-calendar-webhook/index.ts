import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-state, x-goog-resource-id, x-goog-channel-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Google sends these headers with webhook notifications
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const resourceId = req.headers.get('x-goog-resource-id');
    const calendarIdentityId = req.headers.get('x-goog-channel-token');

    console.log('[google-calendar-webhook] Received notification:', {
      channelId,
      resourceState,
      resourceId,
      calendarIdentityId,
    });

    // Verify this is a sync message (Google's verification handshake)
    if (resourceState === 'sync') {
      console.log('[google-calendar-webhook] Sync message received - webhook verified');
      return new Response(null, { status: 200 });
    }

    // Only process 'exists' state (event changed)
    if (resourceState !== 'exists') {
      console.log('[google-calendar-webhook] Ignoring state:', resourceState);
      return new Response(null, { status: 200 });
    }

    if (!calendarIdentityId) {
      console.error('[google-calendar-webhook] No calendar identity ID in token');
      return new Response(null, { status: 400 });
    }

    // Fetch calendar identity to get access token
    const { data: calIdentity, error: calError } = await supabase
      .from('calendar_identities')
      .select('*')
      .eq('id', calendarIdentityId)
      .single();

    if (calError || !calIdentity) {
      console.error('[google-calendar-webhook] Calendar identity not found:', calendarIdentityId);
      return new Response(null, { status: 404 });
    }

    // Fetch all bookings for this user with google_event_id
    const { data: bookings, error: bookingsError } = await supabase
      .from('scheduled_bookings')
      .select('id, google_event_id, candidate_google_event_id, interviewer_id, interviewer_confirmation_status, candidate_email, candidate_confirmation_status, scheduled_start, scheduled_end, meeting_location, google_meet_link, status, last_synced_at, sync_errors')
      .eq('interviewer_id', calIdentity.user_id)
      .in('status', ['confirmed', 'rescheduled'])
      .not('google_event_id', 'is', null);

    if (bookingsError || !bookings || bookings.length === 0) {
      console.log('[google-calendar-webhook] No bookings to sync for user');
      return new Response(null, { status: 200 });
    }

    console.log('[google-calendar-webhook] Found', bookings.length, 'bookings to check');

    // Check token expiration and refresh if needed
    let accessToken = calIdentity.access_token;
    const now = new Date();
    const expiresAt = new Date(calIdentity.token_expires_at);

    if (expiresAt <= now) {
      console.log('[google-calendar-webhook] Token expired, refreshing...');

      const { data: decryptedToken, error: decryptError } = await supabase.rpc(
        'decrypt_refresh_token',
        { encrypted_token: calIdentity.encrypted_refresh_token }
      );

      if (decryptError || !decryptedToken) {
        console.error('[google-calendar-webhook] Failed to decrypt token');
        return new Response(null, { status: 500 });
      }

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: decryptedToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[google-calendar-webhook] Token refresh failed');
        return new Response(null, { status: 500 });
      }

      const refreshData = await tokenResponse.json();
      accessToken = refreshData.access_token;
    }

    // Helper to map Google status
    const mapGoogleStatus = (responseStatus: string): string => {
      if (responseStatus === 'accepted') return 'confirmed';
      if (responseStatus === 'declined') return 'declined';
      return 'pending';
    };

    // Sync each booking's confirmation status and details
    let updatedCount = 0;

    for (const booking of bookings) {
      try {
        // Skip if synced recently (debounce rapid changes)
        const lastSync = booking.last_synced_at ? new Date(booking.last_synced_at) : null;
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        if (lastSync && lastSync > thirtySecondsAgo) {
          console.log(`[google-calendar-webhook] Skipping booking ${booking.id} - recently synced`);
          continue;
        }

        // Fetch event details from Google Calendar
        const eventResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!eventResponse.ok) {
          // Handle event deletion (404)
          if (eventResponse.status === 404) {
            console.log(`[google-calendar-webhook] Event ${booking.google_event_id} not found (deleted)`);
            await supabase
              .from('scheduled_bookings')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: 'Event deleted in Google Calendar',
                google_calendar_cancelled: true,
                sync_source: 'google_calendar',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', booking.id);
            
            // Cancel candidate's event if exists
            if (booking.candidate_google_event_id) {
              await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.candidate_google_event_id}`,
                {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${accessToken}` }
                }
              );
            }
            
            updatedCount++;
            continue;
          }
          console.error(`[google-calendar-webhook] Failed to fetch event ${booking.google_event_id}: ${eventResponse.status}`);
          continue;
        }

        const eventData = await eventResponse.json();

        // Find the interviewer's response in attendees
        const interviewerEmail = calIdentity.email_address;
        const interviewerAttendee = eventData.attendees?.find(
          (a: any) => a.email.toLowerCase() === interviewerEmail.toLowerCase()
        );

        if (!interviewerAttendee) {
          console.log(`[google-calendar-webhook] Interviewer not found in attendees for event ${booking.google_event_id}`);
          continue;
        }

        // Check for event cancellation
        if (eventData.status === 'cancelled') {
          console.log(`[google-calendar-webhook] Event cancelled in Google for booking ${booking.id}`);
          
          await supabase
            .from('scheduled_bookings')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancellation_reason: 'Cancelled in Google Calendar',
              google_calendar_cancelled: true,
              sync_source: 'google_calendar',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', booking.id);

          // Also cancel the candidate's event if it exists
          if (booking.candidate_google_event_id) {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.candidate_google_event_id}`,
              {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
              }
            );
          }

          updatedCount++;
          continue;
        }

        // Extract event times
        const googleStart = eventData.start?.dateTime;
        const googleEnd = eventData.end?.dateTime;
        const currentStart = new Date(booking.scheduled_start).toISOString();
        const currentEnd = new Date(booking.scheduled_end).toISOString();

        // Initialize update tracking
        let needsUpdate = false;
        const updateData: any = {};

        // Detect time changes
        if (googleStart && googleEnd && (googleStart !== currentStart || googleEnd !== currentEnd)) {
          console.log(`[google-calendar-webhook] Time change detected for booking ${booking.id}`);
          console.log(`  Current: ${currentStart} - ${currentEnd}`);
          console.log(`  Google:  ${googleStart} - ${googleEnd}`);
          
          updateData.scheduled_start = googleStart;
          updateData.scheduled_end = googleEnd;
          updateData.status = 'rescheduled';
          needsUpdate = true;
        }

        // Detect meeting location changes
        const googleLocation = eventData.location || '';
        const googleMeetLink = eventData.conferenceData?.entryPoints?.[0]?.uri || eventData.hangoutLink || '';

        if (googleLocation && googleLocation !== booking.meeting_location) {
          updateData.meeting_location = googleLocation;
          needsUpdate = true;
        }

        if (googleMeetLink && googleMeetLink !== booking.google_meet_link) {
          updateData.google_meet_link = googleMeetLink;
          needsUpdate = true;
        }

        // Map Google response status to our status (reuse interviewerAttendee from above)
        if (interviewerAttendee) {
          const newStatus = mapGoogleStatus(interviewerAttendee.responseStatus);

          if (newStatus !== booking.interviewer_confirmation_status) {
            console.log(`[google-calendar-webhook] Updating interviewer status for booking ${booking.id}: ${booking.interviewer_confirmation_status} -> ${newStatus}`);
            updateData.interviewer_confirmation_status = newStatus;
            if (newStatus === 'confirmed') {
              updateData.interviewer_confirmed_at = new Date().toISOString();
            }
            needsUpdate = true;
          }
        }

        // Check candidate's response from interviewer's event
        if (booking.candidate_email) {
          const candidateAttendee = eventData.attendees?.find(
            (a: any) => a.email.toLowerCase() === booking.candidate_email.toLowerCase()
          );

          if (candidateAttendee) {
            const candidateStatus = mapGoogleStatus(candidateAttendee.responseStatus);

            if (candidateStatus !== booking.candidate_confirmation_status) {
              console.log(`[google-calendar-webhook] Updating candidate status for booking ${booking.id}: ${booking.candidate_confirmation_status} -> ${candidateStatus}`);
              updateData.candidate_confirmation_status = candidateStatus;
              if (candidateStatus === 'confirmed') {
                updateData.candidate_confirmed_at = new Date().toISOString();
              }
              needsUpdate = true;
            }
          }
        }

        // Sync candidate's separate event if it exists
        if (booking.candidate_google_event_id) {
          try {
            const candidateEventResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.candidate_google_event_id}`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (candidateEventResponse.ok) {
              const candidateEventData = await candidateEventResponse.json();

              // Check if candidate cancelled their event
              if (candidateEventData.status === 'cancelled') {
                updateData.candidate_confirmation_status = 'declined';
                updateData.candidate_confirmed_at = null;
                needsUpdate = true;
              } else {
                // Sync candidate's response from their event
                const candidateAttendee = candidateEventData.attendees?.find(
                  (a: any) => a.email.toLowerCase() === booking.candidate_email.toLowerCase()
                );

                if (candidateAttendee) {
                  const candidateStatus = mapGoogleStatus(candidateAttendee.responseStatus);
                  if (candidateStatus !== booking.candidate_confirmation_status) {
                    updateData.candidate_confirmation_status = candidateStatus;
                    if (candidateStatus === 'confirmed') {
                      updateData.candidate_confirmed_at = new Date().toISOString();
                    }
                    needsUpdate = true;
                  }
                }
              }
            } else if (candidateEventResponse.status === 404) {
              // Candidate deleted their event
              console.log(`[google-calendar-webhook] Candidate event ${booking.candidate_google_event_id} not found (deleted)`);
              updateData.candidate_confirmation_status = 'declined';
              updateData.candidate_google_event_id = null;
              needsUpdate = true;
            }
          } catch (error: any) {
            console.error(`[google-calendar-webhook] Error syncing candidate event:`, error);
            const syncErrors = Array.isArray(booking.sync_errors) ? booking.sync_errors : [];
            updateData.sync_errors = [
              ...syncErrors.slice(-9),
              { timestamp: new Date().toISOString(), error: error.message, event_type: 'candidate' }
            ];
          }
        }

        // Perform update if needed
        if (needsUpdate) {
          updateData.sync_source = 'google_calendar';
          updateData.last_synced_at = new Date().toISOString();

          await supabase
            .from('scheduled_bookings')
            .update(updateData)
            .eq('id', booking.id);

          updatedCount++;
        }
      } catch (error: any) {
        console.error(`[google-calendar-webhook] Error syncing booking ${booking.id}:`, error);
        
        // Store error for later review
        try {
          const syncErrors = Array.isArray(booking.sync_errors) ? booking.sync_errors : [];
          await supabase
            .from('scheduled_bookings')
            .update({
              sync_errors: [
                ...syncErrors.slice(-9), // Keep last 10 errors
                {
                  timestamp: new Date().toISOString(),
                  error_message: error.message,
                  event_id: booking.google_event_id
                }
              ]
            })
            .eq('id', booking.id);
        } catch (updateError) {
          console.error(`[google-calendar-webhook] Failed to store sync error:`, updateError);
        }
      }
    }

    console.log(`[google-calendar-webhook] Updated ${updatedCount} bookings`);

    return new Response(
      JSON.stringify({ success: true, updated: updatedCount }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[google-calendar-webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
