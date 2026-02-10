// Version: 1.1.0 - Interview cancellation with shared CORS utilities
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = corsHeadersFor(req.headers.get('Origin') ?? undefined);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { booking_id, reason } = await req.json();

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[cancel-booking] Cancelling booking:', booking_id);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch booking details (without join to handle NULL foreign keys)
    const { data: booking, error: fetchError } = await supabase
      .from('scheduled_bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch interviewer profile separately if interviewer_id exists
    let interviewerProfile = null;
    if (booking.interviewer_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('user_id', booking.interviewer_id)
        .maybeSingle();
      
      interviewerProfile = profile;
    }

    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Booking is already cancelled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get job title and stage name for email context
    let jobTitle = 'Position';
    let stageName = 'Interview';

    if (booking.job_hiring_stage_id) {
      const { data: stageData } = await supabase
        .from('job_hiring_stages')
        .select('stage_name, job:jobs(title)')
        .eq('id', booking.job_hiring_stage_id)
        .maybeSingle();

      if (stageData) {
        jobTitle = stageData.job?.title || jobTitle;
        stageName = stageData.stage_name || stageName;
      }
    }

    const interviewTitle = `${stageName} - ${jobTitle}`;

    // Delete Google Calendar event if exists
    if (booking.google_event_id) {
      console.log('[cancel-booking] Deleting Google Calendar event:', booking.google_event_id);

      const { data: calIdentity } = await supabase
        .from('calendar_identities')
        .select('*')
        .eq('user_id', booking.interviewer_id)
        .eq('is_active', true)
        .single();

      if (calIdentity) {
        let accessToken = calIdentity.access_token;

        // Check if token is expired and refresh if needed
        const now = new Date();
        const expiresAt = new Date(calIdentity.token_expires_at);

        if (expiresAt <= now) {
          console.log('[cancel-booking] Refreshing expired access token...');

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

        // Delete the event from Google Calendar
        try {
          const deleteResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (deleteResponse.ok || deleteResponse.status === 404) {
            console.log('[cancel-booking] Google Calendar event deleted successfully');
          } else {
            console.error('[cancel-booking] Failed to delete Google Calendar event:', deleteResponse.status);
          }
        } catch (error) {
          console.error('[cancel-booking] Error deleting Google Calendar event:', error);
        }
      }
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from('scheduled_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason || null,
      })
      .eq('id', booking_id);

    if (updateError) throw updateError;

    console.log('[cancel-booking] Booking status updated to cancelled');

    // Generate cancellation ICS file
    const formatDateForICS = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeICSText = (text: string): string => {
      return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GoGio//Interview Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:CANCEL',
      'BEGIN:VEVENT',
      `UID:${booking.ics_uid}`,
      `DTSTAMP:${formatDateForICS(new Date())}`,
      `DTSTART:${formatDateForICS(new Date(booking.scheduled_start))}`,
      `DTEND:${formatDateForICS(new Date(booking.scheduled_end))}`,
      `SUMMARY:${escapeICSText('CANCELLED: ' + interviewTitle)}`,
      `DESCRIPTION:${escapeICSText('This interview has been cancelled.' + (reason ? '\n\nReason: ' + reason : ''))}`,
      `ORGANIZER;CN=${escapeICSText(interviewerProfile ? `${interviewerProfile.first_name} ${interviewerProfile.last_name}` : 'Interviewer')}:mailto:${interviewerProfile?.email || 'no-reply@app.gogio.io'}`,
      `ATTENDEE;CN=${escapeICSText(booking.candidate_name)};RSVP=TRUE:mailto:${booking.candidate_email}`,
      // Add guest attendees to cancellation ICS
      ...((booking.guest_emails || []) as string[]).map((ge: string) => `ATTENDEE;RSVP=TRUE:mailto:${ge}`),
      'STATUS:CANCELLED',
      'SEQUENCE:1',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const icsBase64 = btoa(icsContent);

    // Send cancellation email to candidate
    // Import email template
    const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

    const formattedDate = new Date(booking.scheduled_start).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: booking.candidate_timezone,
    });

    const cancellationDetails = [
      `<strong>Interview:</strong> ${interviewTitle}`,
      `<strong>Originally Scheduled:</strong> ${formattedDate}`,
    ];

    if (reason) {
      cancellationDetails.push(`<strong>Reason:</strong> ${reason}`);
    }

    const candidateContent = `
      <p>We regret to inform you that your scheduled interview has been cancelled.</p>
      <div class="divider"></div>
      ${formatEmailList(cancellationDetails)}
      <p style="margin-top: 24px;">A calendar cancellation has been sent to update your calendar. If you have any questions or would like to reschedule, please don't hesitate to contact us.</p>
    `;

    const candidateEmailHtml = createEmailTemplate({
      recipientName: booking.candidate_name,
      preheaderText: `Your interview scheduled for ${formattedDate} has been cancelled`,
      title: 'Interview Cancelled',
      content: candidateContent,
      footerNote: 'We apologize for any inconvenience this may cause.'
    });

    await supabase.functions.invoke('send-user-email', {
      body: {
        to: [booking.candidate_email],
        subject: `Interview Cancelled: ${interviewTitle}`,
        html: candidateEmailHtml,
        attachments: [{
          filename: 'cancellation.ics',
          content: icsBase64,
          encoding: 'base64',
          contentType: 'text/calendar',
        }],
      },
    });

    // Send cancellation email to interviewer if available
    if (interviewerProfile?.email) {
      const interviewerCancellationDetails = [
        `<strong>Candidate:</strong> ${booking.candidate_name} (<a href="mailto:${booking.candidate_email}" style="color: #6366f1;">${booking.candidate_email}</a>)`,
        `<strong>Interview:</strong> ${interviewTitle}`,
        `<strong>Originally Scheduled:</strong> ${formattedDate}`,
      ];

      if (reason) {
        interviewerCancellationDetails.push(`<strong>Reason:</strong> ${reason}`);
      }

      const interviewerContent = `
        <p>An interview on your calendar has been cancelled.</p>
        <div class="divider"></div>
        ${formatEmailList(interviewerCancellationDetails)}
        <p style="margin-top: 24px;">A calendar cancellation has been sent to update your calendar automatically.</p>
      `;

      const interviewerEmailHtml = createEmailTemplate({
        recipientName: interviewerProfile.first_name,
        preheaderText: `Interview with ${booking.candidate_name} has been cancelled`,
        title: 'Interview Cancelled',
        content: interviewerContent,
      });

      await supabase.functions.invoke('send-user-email', {
        body: {
          to: [interviewerProfile.email],
          subject: `Interview Cancelled: ${interviewTitle}`,
          html: interviewerEmailHtml,
          attachments: [{
            filename: 'cancellation.ics',
            content: icsBase64,
            encoding: 'base64',
            contentType: 'text/calendar',
          }],
        },
      });
    }

    // Send cancellation emails to guests
    const guestEmails = (booking.guest_emails || []) as string[];
    if (guestEmails.length > 0) {
      const guestCancellationDetails = [
        `<strong>Interview:</strong> ${interviewTitle}`,
        `<strong>Originally Scheduled:</strong> ${formattedDate}`,
      ];

      if (reason) {
        guestCancellationDetails.push(`<strong>Reason:</strong> ${reason}`);
      }

      const guestContent = `
        <p>An interview you were invited to has been cancelled.</p>
        <div class="divider"></div>
        ${formatEmailList(guestCancellationDetails)}
        <p style="margin-top: 24px;">A calendar cancellation has been attached to update your calendar.</p>
      `;

      for (const guestEmail of guestEmails) {
        try {
          const guestEmailHtml = createEmailTemplate({
            recipientName: 'there',
            preheaderText: `Interview scheduled for ${formattedDate} has been cancelled`,
            title: 'Interview Cancelled',
            content: guestContent,
          });

          await supabase.functions.invoke('send-user-email', {
            body: {
              to: [guestEmail],
              subject: `Interview Cancelled: ${interviewTitle}`,
              html: guestEmailHtml,
              attachments: [{
                filename: 'cancellation.ics',
                content: icsBase64,
                encoding: 'base64',
                contentType: 'text/calendar',
              }],
            },
          });
          console.log('[cancel-booking] Guest cancellation email sent to:', guestEmail);
        } catch (guestError) {
          console.error('[cancel-booking] Failed to send guest cancellation to', guestEmail, ':', guestError);
        }
      }
    }
    if (booking.candidate_id && booking.job_id) {
      await supabase.from('activities').insert({
        user_id: user.id,
        organization_id: booking.organization_id,
        activity_type: 'interview_cancelled',
        title: 'Interview Cancelled',
        description: `Cancelled ${stageName} interview${reason ? ': ' + reason : ''}`,
        entity_type: 'candidate',
        entity_id: booking.candidate_id,
        metadata: {
          job_id: booking.job_id,
          booking_id: booking.id,
          interviewer_id: booking.interviewer_id,
          scheduled_start: booking.scheduled_start,
          cancelled_by: user.id,
          reason: reason || null,
        },
      });
    }

    console.log('[cancel-booking] Cancellation complete');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Interview cancelled successfully',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cancel-booking] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
