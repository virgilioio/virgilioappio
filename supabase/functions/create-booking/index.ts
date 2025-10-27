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
      // Internal booking context (optional)
      job_id,
      candidate_id,
      job_candidate_association_id,
      job_hiring_stage_id,
      booked_by_user_id,
    } = await req.json();

    console.log('[create-booking] Creating booking for:', candidate_email);

    // Fetch stage name and job title if this is an internal booking
    let stageName = 'Interview';
    let jobTitle = '';

    if (job_hiring_stage_id) {
      const { data: stageData } = await supabase
        .from('job_hiring_stages')
        .select('stage:job_stages(stage_name)')
        .eq('id', job_hiring_stage_id)
        .single();
      
      if (stageData?.stage?.stage_name) {
        stageName = stageData.stage.stage_name;
      }
    }

    if (job_id) {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', job_id)
        .single();
      
      if (jobData?.title) {
        jobTitle = ` - ${jobData.title}`;
      }
    }

    const interviewTitle = `${stageName} with ${candidate_name}${jobTitle}`;

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
              summary: interviewTitle,
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

    // Generate unique ICS UID
    const bookingId = crypto.randomUUID();
    const icsUid = `booking-${bookingId}@virgilio.io`;

    // Insert booking with all Phase 4 fields
    const { data: booking, error: insertError } = await supabase
      .from('scheduled_bookings')
      .insert({
        id: bookingId,
        booking_config_id,
        interviewer_id: config.user_id,
        organization_id: config.organization_id,
        candidate_name,
        candidate_email,
        candidate_phone,
        candidate_timezone,
        scheduled_start,
        scheduled_end,
        duration_minutes: config.duration_minutes,
        meeting_location: googleMeetLink || config.meeting_location,
        meeting_type: googleMeetLink ? 'google_meet' : 'other',
        ics_uid: icsUid,
        notes,
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
        status: 'confirmed',
        // Confirmation tracking
        interviewer_confirmation_status: 'pending',
        candidate_confirmation_status: 'confirmed',
        candidate_confirmed_at: new Date().toISOString(),
        // Internal booking context
        candidate_id: candidate_id || null,
        job_id: job_id || null,
        job_candidate_association_id: job_candidate_association_id || null,
        job_hiring_stage_id: job_hiring_stage_id || null,
        booked_by: booked_by_user_id || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('[create-booking] Booking created successfully:', booking.id);

    // Generate ICS file content
    const formatDateForICS = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeICSText = (text: string): string => {
      return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Virgilio//Interview Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${icsUid}`,
      `DTSTAMP:${formatDateForICS(new Date())}`,
      `DTSTART:${formatDateForICS(new Date(scheduled_start))}`,
      `DTEND:${formatDateForICS(new Date(scheduled_end))}`,
      `SUMMARY:${escapeICSText(interviewTitle)}`,
      `DESCRIPTION:${escapeICSText(`Scheduled via Virgilio\n\nCandidate Notes:\n${notes || 'None'}`)}`,
      `LOCATION:${escapeICSText(googleMeetLink || config.meeting_location || '')}`,
      `ORGANIZER;CN=${escapeICSText(`${profile.first_name} ${profile.last_name}`)}:mailto:${profile.email}`,
      `ATTENDEE;CN=${escapeICSText(candidate_name)};RSVP=TRUE:mailto:${candidate_email}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const icsBase64 = btoa(icsContent);

    // Send confirmation email to candidate
    try {
      const candidateEmailBody = `
        <h2>Your Interview is Confirmed!</h2>
        <p>Hi ${candidate_name},</p>
        <p>Your interview with <strong>${profile.first_name} ${profile.last_name}</strong> has been confirmed.</p>
        
        <h3>Meeting Details:</h3>
        <ul>
          <li><strong>Date:</strong> ${new Date(scheduled_start).toLocaleString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: candidate_timezone,
          })}</li>
          <li><strong>Duration:</strong> ${config.duration_minutes} minutes</li>
          <li><strong>Location:</strong> ${googleMeetLink ? `<a href="${googleMeetLink}">Google Meet Link</a>` : config.meeting_location}</li>
        </ul>
        
        <p>A calendar invite is attached to this email. Please add it to your calendar.</p>
        ${notes ? `<p><strong>Your notes:</strong> ${notes}</p>` : ''}
        <p>If you need to reschedule, please contact us directly.</p>
        <p>Best regards,<br/>The Virgilio Team</p>
      `;

      await supabase.functions.invoke('send-user-email', {
        body: {
          from_email: profile.email,
          to: [candidate_email],
          subject: `Your Interview is Confirmed: ${stageName}${jobTitle}`,
          body_html: candidateEmailBody,
          attachments: [{
            filename: 'interview.ics',
            content: icsBase64,
            content_type: 'text/calendar',
          }],
        },
      });

      console.log('[create-booking] Candidate confirmation email sent');
    } catch (emailError) {
      console.error('[create-booking] Failed to send candidate email:', emailError);
    }

    // Send notification email to interviewer
    try {
      const interviewerEmailBody = `
        <h2>New Interview Scheduled</h2>
        <p>Hi ${profile.first_name},</p>
        <p>A candidate has booked an interview with you:</p>
        
        <h3>Candidate Details:</h3>
        <ul>
          <li><strong>Name:</strong> ${candidate_name}</li>
          <li><strong>Email:</strong> ${candidate_email}</li>
          ${candidate_phone ? `<li><strong>Phone:</strong> ${candidate_phone}</li>` : ''}
        </ul>
        
        <h3>Meeting Details:</h3>
        <ul>
          <li><strong>Date:</strong> ${new Date(scheduled_start).toLocaleString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: config.timezone,
          })}</li>
          <li><strong>Duration:</strong> ${config.duration_minutes} minutes</li>
          <li><strong>Location:</strong> ${googleMeetLink ? `<a href="${googleMeetLink}">Google Meet Link</a>` : config.meeting_location}</li>
        </ul>
        
        ${notes ? `<h3>Candidate Notes:</h3><p>${notes}</p>` : ''}
        <p>The calendar invite is attached. ${googleEventId ? 'It has also been added to your Google Calendar.' : ''}</p>
        <p>View details in your <a href="https://virgilio.tech/settings">Virgilio dashboard</a>.</p>
      `;

      await supabase.functions.invoke('send-user-email', {
        body: {
          from_email: 'noreply@virgilio.tech',
          to: [profile.email],
          subject: `New Interview Scheduled: ${stageName} with ${candidate_name}${jobTitle}`,
          body_html: interviewerEmailBody,
          attachments: [{
            filename: 'interview.ics',
            content: icsBase64,
            content_type: 'text/calendar',
          }],
        },
      });

      console.log('[create-booking] Interviewer notification email sent');
    } catch (emailError) {
      console.error('[create-booking] Failed to send interviewer email:', emailError);
    }

    // Log activity
    try {
      const activityMetadata: Record<string, any> = {
        booking_id: bookingId,
        candidate_email,
        scheduled_start,
        scheduled_end,
      };

      // Add internal booking context to metadata if present
      if (job_id) activityMetadata.job_id = job_id;
      if (candidate_id) activityMetadata.candidate_id = candidate_id;
      if (job_hiring_stage_id) activityMetadata.job_hiring_stage_id = job_hiring_stage_id;

      const activityTitle = booked_by_user_id
        ? `Interview scheduled for ${candidate_name}`
        : `Interview scheduled with ${candidate_name}`;

      await supabase.rpc('log_activity', {
        p_user_id: booked_by_user_id || config.user_id,
        p_organization_id: config.organization_id,
        p_activity_type: 'interview_scheduled',
        p_title: activityTitle,
        p_description: `Candidate ${candidate_name} booked an interview for ${new Date(scheduled_start).toLocaleString()}`,
        p_metadata: activityMetadata,
      });
    } catch (activityError) {
      console.error('[create-booking] Failed to log activity:', activityError);
    }

    return new Response(JSON.stringify({
      success: true,
      booking_id: booking.id,
      ics_uid: icsUid,
      google_event_created: !!googleEventId,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
      warning: googleEventId ? null : 'Booking created but calendar event could not be created',
      confirmation_message: 'Booking confirmed! Check your email for details.',
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
