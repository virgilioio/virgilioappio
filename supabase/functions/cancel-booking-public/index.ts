import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { token, booking_id, reason } = await req.json();

    if (!token || !booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing token or booking_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token
    const { data: tokenData } = await supabase
      .from('booking_link_tokens')
      .select('candidate_id, jhs_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch booking and verify it belongs to this token's candidate+stage
    const { data: booking, error: fetchError } = await supabase
      .from('scheduled_bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('candidate_id', tokenData.candidate_id)
      .eq('job_hiring_stage_id', tokenData.jhs_id)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found or does not match token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch interviewer profile for emails
    let interviewerProfile = null;
    if (booking.interviewer_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('user_id', booking.interviewer_id)
        .maybeSingle();
      interviewerProfile = profile;
    }

    // Get job/stage names for email context
    let jobTitle = 'Position';
    let stageName = 'Interview';

    if (booking.job_hiring_stage_id) {
      const { data: stageData } = await supabase
        .from('job_hiring_stages')
        .select('stage:job_stages(stage_name)')
        .eq('id', booking.job_hiring_stage_id)
        .maybeSingle();

      if (stageData?.stage?.stage_name) {
        stageName = stageData.stage.stage_name;
      }
    }

    if (booking.job_id) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', booking.job_id)
        .maybeSingle();
      if (jobData?.title) jobTitle = jobData.title;
    }

    const interviewTitle = `${stageName} - ${jobTitle}`;

    // Delete Google Calendar events if they exist
    if (booking.google_event_id && booking.interviewer_id) {
      try {
        const { data: calIdentity } = await supabase
          .from('calendar_identities')
          .select('*')
          .eq('user_id', booking.interviewer_id)
          .eq('is_active', true)
          .maybeSingle();

        if (calIdentity) {
          let accessToken = calIdentity.access_token;
          const expiresAt = new Date(calIdentity.token_expires_at);

          if (expiresAt <= new Date()) {
            const { data: decryptedToken } = await supabase.rpc('decrypt_refresh_token', {
              encrypted_token: calIdentity.encrypted_refresh_token,
            });

            if (decryptedToken) {
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

              if (tokenRefreshResponse.ok) {
                const refreshData = await tokenRefreshResponse.json();
                accessToken = refreshData.access_token;

                await supabase
                  .from('calendar_identities')
                  .update({
                    access_token: accessToken,
                    token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                  })
                  .eq('id', calIdentity.id);
              }
            }
          }

          // Delete interviewer's calendar event
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
          );

          // Delete candidate's calendar event if exists
          if (booking.candidate_google_event_id) {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.candidate_google_event_id}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
            );
          }

          console.log('[cancel-booking-public] Google Calendar events deleted');
        }
      } catch (calError) {
        console.error('[cancel-booking-public] Calendar deletion error:', calError);
      }
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('scheduled_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Cancelled by candidate',
      })
      .eq('id', booking_id);

    if (updateError) throw updateError;

    // Send cancellation emails
    try {
      const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

      const formattedDate = new Date(booking.scheduled_start).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZone: booking.candidate_timezone,
      });

      const cancellationDetails = [
        `<strong>Interview:</strong> ${interviewTitle}`,
        `<strong>Originally Scheduled:</strong> ${formattedDate}`,
      ];

      if (reason) cancellationDetails.push(`<strong>Reason:</strong> ${reason}`);

      // Email to interviewer
      if (interviewerProfile?.email) {
        const interviewerContent = `
          <p>A candidate has cancelled their interview.</p>
          <div class="divider"></div>
          <p><strong>Candidate:</strong> ${booking.candidate_name} (${booking.candidate_email})</p>
          ${formatEmailList(cancellationDetails)}
        `;

        const interviewerHtml = createEmailTemplate({
          recipientName: interviewerProfile.first_name,
          preheaderText: `Interview with ${booking.candidate_name} has been cancelled`,
          title: 'Interview Cancelled by Candidate',
          content: interviewerContent,
        });

        await supabase.functions.invoke('send-user-email', {
          body: {
            to: [interviewerProfile.email],
            subject: `Interview Cancelled: ${interviewTitle} with ${booking.candidate_name}`,
            body_html: interviewerHtml,
          },
        });
      }

      // Email to candidate
      const candidateContent = `
        <p>Your interview has been successfully cancelled.</p>
        <div class="divider"></div>
        ${formatEmailList(cancellationDetails)}
        <p style="margin-top: 24px;">If you'd like to reschedule, you can use the same booking link.</p>
      `;

      const candidateHtml = createEmailTemplate({
        recipientName: booking.candidate_name,
        preheaderText: `Your interview has been cancelled`,
        title: 'Interview Cancelled',
        content: candidateContent,
      });

      await supabase.functions.invoke('send-user-email', {
        body: {
          to: [booking.candidate_email],
          subject: `Interview Cancelled: ${interviewTitle}`,
          body_html: candidateHtml,
        },
      });
    } catch (emailError) {
      console.error('[cancel-booking-public] Email error:', emailError);
    }

    // Log activity
    if (booking.candidate_id && booking.job_id) {
      try {
        await supabase.rpc('log_activity', {
          p_user_id: booking.interviewer_id || booking.candidate_id,
          p_organization_id: booking.organization_id,
          p_activity_type: 'interview_cancelled',
          p_title: `Interview cancelled by candidate ${booking.candidate_name}`,
          p_description: `Candidate cancelled ${stageName} interview${reason ? ': ' + reason : ''}`,
          p_metadata: {
            booking_id: booking.id,
            job_id: booking.job_id,
            candidate_id: booking.candidate_id,
            cancelled_by: 'candidate',
          },
        });
      } catch (actError) {
        console.error('[cancel-booking-public] Activity log error:', actError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Interview cancelled successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cancel-booking-public] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
