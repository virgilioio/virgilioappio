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
      .select('id, google_event_id, interviewer_id, interviewer_confirmation_status, candidate_email, candidate_confirmation_status')
      .eq('interviewer_id', calIdentity.user_id)
      .eq('status', 'confirmed')
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

    // Sync each booking's confirmation status
    let updatedCount = 0;

    for (const booking of bookings) {
      try {
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
          console.error(`[google-calendar-webhook] Failed to fetch event ${booking.google_event_id}`);
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

        // Map Google response status to our status
        let newStatus = booking.interviewer_confirmation_status;
        const responseStatus = interviewerAttendee.responseStatus;

        if (responseStatus === 'accepted') {
          newStatus = 'confirmed';
        } else if (responseStatus === 'declined') {
          newStatus = 'declined';
        } else if (responseStatus === 'tentative' || responseStatus === 'needsAction') {
          newStatus = 'pending';
        }

        // Check if we need to update interviewer status
        let needsUpdate = false;
        const updateData: any = {};

        if (newStatus !== booking.interviewer_confirmation_status) {
          console.log(`[google-calendar-webhook] Updating interviewer status for booking ${booking.id}: ${booking.interviewer_confirmation_status} -> ${newStatus}`);
          updateData.interviewer_confirmation_status = newStatus;
          if (newStatus === 'confirmed') {
            updateData.interviewer_confirmed_at = new Date().toISOString();
          }
          needsUpdate = true;
        }

        // Also check candidate's response
        if (booking.candidate_email) {
          const candidateAttendee = eventData.attendees?.find(
            (a: any) => a.email.toLowerCase() === booking.candidate_email.toLowerCase()
          );

          if (candidateAttendee) {
            let candidateStatus = booking.candidate_confirmation_status;
            const candidateResponseStatus = candidateAttendee.responseStatus;

            if (candidateResponseStatus === 'accepted') {
              candidateStatus = 'confirmed';
            } else if (candidateResponseStatus === 'declined') {
              candidateStatus = 'declined';
            } else if (candidateResponseStatus === 'tentative' || candidateResponseStatus === 'needsAction') {
              candidateStatus = 'pending';
            }

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

        // Perform update if needed
        if (needsUpdate) {
          await supabase
            .from('scheduled_bookings')
            .update(updateData)
            .eq('id', booking.id);

          updatedCount++;
        }
      } catch (error) {
        console.error(`[google-calendar-webhook] Error syncing booking ${booking.id}:`, error);
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
