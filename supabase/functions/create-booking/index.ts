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
      send_invitation = true, // Default to true for backward compatibility
      // Internal booking context (optional)
      job_id,
      candidate_id,
      job_candidate_association_id,
      job_hiring_stage_id,
      booked_by_user_id,
      // Meeting location preferences
      meeting_type_preference = 'google_meet', // 'google_meet' or 'custom'
      custom_meeting_location = null,
    } = await req.json();

    // Validate custom location if specified
    if (meeting_type_preference === 'custom' && (!custom_meeting_location || custom_meeting_location.trim() === '')) {
      return new Response(JSON.stringify({
        error: 'Custom meeting location is required when meeting type is set to custom',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Check if slot is still available (strict overlap check - back-to-back bookings are allowed)
    const { data: conflictingBookings } = await supabase
      .from('scheduled_bookings')
      .select('id')
      .eq('booking_config_id', booking_config_id)
      .eq('status', 'confirmed')
      .lt('scheduled_start', scheduled_end)    // existing_start < new_end
      .gt('scheduled_end', scheduled_start)    // existing_end > new_start
      .limit(1);

    if (conflictingBookings && conflictingBookings.length > 0) {
      return new Response(JSON.stringify({
        error: 'This time slot is no longer available. Please select another time.',
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Google Calendar events (two separate events approach)
    let googleEventId = null;
    let candidateGoogleEventId = null;
    let googleMeetLink = null;

    // Construct candidate profile URL for scorecard submission
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.gogio.io';
    const candidateProfileUrl = (job_id && candidate_id) 
      ? `${frontendUrl}/jobs/${job_id}?candidate=${candidate_id}`
      : null;

    // Generate unique transcript ingest code (8 alphanumeric chars)
    const generateIngestCode = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    const transcriptIngestCode = generateIngestCode();
    const transcriptIngestEmail = `int_${transcriptIngestCode}@ingest.gogio.io`;
    console.log('[create-booking] Generated transcript ingest email:', transcriptIngestEmail);

    if (accessToken && calendarIdentity) {
      try {
        // 1. Create interviewer's calendar event (always created)
        console.log('[create-booking] Creating interviewer\'s Google Calendar event...');

        const interviewerEventResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary: `Interview: ${candidate_name}`,
              description: `Interview scheduled via GoGio\n\nCANDIDATE DETAILS:\nName: ${candidate_name}\nEmail: ${candidate_email}${candidate_phone ? `\nPhone: ${candidate_phone}` : ''}${notes ? `\n\nNOTES:\n${notes}` : ''}${meeting_type_preference === 'custom' && custom_meeting_location ? `\n\nMEETING LOCATION:\n${custom_meeting_location}` : ''}${candidateProfileUrl ? `\n\n📝 SUBMIT SCORECARD:\n${candidateProfileUrl}` : ''}\n\n🎙️ TRANSCRIPT EMAIL:\n${transcriptIngestEmail}\n(Add this to your note-taking app to auto-generate interview notes)`,
              start: {
                dateTime: scheduled_start,
                timeZone: config.timezone,
              },
              end: {
                dateTime: scheduled_end,
                timeZone: config.timezone,
              },
              attendees: [
                { email: profile.email }, // Interviewer
                { email: transcriptIngestEmail, optional: true, responseStatus: 'accepted' }, // Transcript ingest (optional attendee)
              ],
              conferenceData: meeting_type_preference === 'google_meet' ? {
                createRequest: {
                  requestId: crypto.randomUUID(),
                  conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
              } : undefined,
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

        if (!interviewerEventResponse.ok) {
          const errorText = await interviewerEventResponse.text();
          console.error('[create-booking] Interviewer calendar event creation failed:', interviewerEventResponse.status, errorText);
          
          await supabase
            .from('calendar_identities')
            .update({ 
              sync_status: 'error', 
              sync_error_message: `Calendar event creation failed: ${interviewerEventResponse.status}`,
            })
            .eq('id', calendarIdentity.id);

          console.warn('[create-booking] Proceeding with booking creation without calendar event');
        } else {
        const interviewerEventData = await interviewerEventResponse.json();
          googleEventId = interviewerEventData.id;
          googleMeetLink = interviewerEventData.hangoutLink || interviewerEventData.conferenceData?.entryPoints?.[0]?.uri || null;
          const conferenceData = interviewerEventData.conferenceData; // Capture full conference data for candidate event
          
          console.log('[create-booking] Interviewer calendar event created successfully:', googleEventId);
          
          await supabase
            .from('calendar_identities')
            .update({ 
              sync_status: 'healthy',
              sync_error_message: null,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', calendarIdentity.id);

          // 2. Create candidate's calendar event (only if send_invitation is true)
          if (send_invitation && googleMeetLink) {
            try {
              console.log('[create-booking] Creating candidate\'s Google Calendar event...');

              const candidateEventResponse = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    summary: interviewTitle,
                    description: `You have an interview scheduled with ${profile.first_name} ${profile.last_name}.\n\n${
                      googleMeetLink 
                        ? `Join via Google Meet: ${googleMeetLink}` 
                        : custom_meeting_location 
                          ? `Location: ${custom_meeting_location}` 
                          : config.meeting_location 
                            ? `Location: ${config.meeting_location}` 
                            : ''
                    }${notes ? `\n\nAdditional information:\n${notes}` : ''}`,
                    start: {
                      dateTime: scheduled_start,
                      timeZone: candidate_timezone,
                    },
                    end: {
                      dateTime: scheduled_end,
                      timeZone: candidate_timezone,
                    },
                    attendees: [
                      { email: candidate_email }, // Only candidate
                    ],
                    reminders: {
                      useDefault: false,
                      overrides: [
                        { method: 'email', minutes: 24 * 60 },
                        { method: 'popup', minutes: 30 },
                      ],
                    },
                    ...(conferenceData && { conferenceData }), // Attach Google Meet to candidate's event
                  }),
                }
              );

              if (!candidateEventResponse.ok) {
                const errorText = await candidateEventResponse.text();
                console.error('[create-booking] Candidate calendar event creation failed:', candidateEventResponse.status, errorText);
              } else {
                const candidateEventData = await candidateEventResponse.json();
                candidateGoogleEventId = candidateEventData.id;
                console.log('[create-booking] Candidate calendar event created successfully:', candidateGoogleEventId);
              }
            } catch (error) {
              console.error('[create-booking] Error creating candidate calendar event:', error);
            }
          } else {
            console.log('[create-booking] Skipping candidate calendar event (send_invitation=false or no Meet link)');
          }
        }
      } catch (error) {
        console.error('[create-booking] Google Calendar integration error:', error);
      }
    } else {
      console.log('[create-booking] No calendar integration available, proceeding without calendar event');
    }

    // Generate unique ICS UID
    const bookingId = crypto.randomUUID();
    const icsUid = `booking-${bookingId}@gogio.io`;

    // Insert booking with all Phase 4 fields and two-event support
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
        meeting_location: meeting_type_preference === 'google_meet' 
          ? (googleMeetLink || config.meeting_location) 
          : custom_meeting_location,
        meeting_type: meeting_type_preference,
        ics_uid: icsUid,
        notes,
        google_event_id: googleEventId, // Interviewer's event
        candidate_google_event_id: candidateGoogleEventId, // Candidate's event (null if not sent)
        google_meet_link: googleMeetLink,
        status: 'confirmed',
        // Confirmation tracking
        interviewer_confirmation_status: 'pending',
        candidate_confirmation_status: send_invitation ? 'pending' : null,
        candidate_confirmed_at: send_invitation ? new Date().toISOString() : null,
        // Internal booking context
        candidate_id: candidate_id || null,
        job_id: job_id || null,
        job_candidate_association_id: job_candidate_association_id || null,
        job_hiring_stage_id: job_hiring_stage_id || null,
        booked_by: booked_by_user_id || null,
        // Transcript ingest
        transcript_ingest_code: transcriptIngestCode,
        transcript_ingest_email: transcriptIngestEmail,
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

    // Only include candidate in ICS if send_invitation is true
    const icsAttendees = send_invitation 
      ? `ATTENDEE;CN=${escapeICSText(candidate_name)};RSVP=TRUE:mailto:${candidate_email}\r\n`
      : '';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GoGio//Interview Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${icsUid}`,
      `DTSTAMP:${formatDateForICS(new Date())}`,
      `DTSTART:${formatDateForICS(new Date(scheduled_start))}`,
      `DTEND:${formatDateForICS(new Date(scheduled_end))}`,
      `SUMMARY:${escapeICSText(interviewTitle)}`,
      `DESCRIPTION:${escapeICSText(`Scheduled via GoGio\n\nCandidate Notes:\n${notes || 'None'}`)}`,
      `LOCATION:${escapeICSText(
        meeting_type_preference === 'google_meet' 
          ? (googleMeetLink || config.meeting_location || '') 
          : (custom_meeting_location || '')
      )}`,
      `ORGANIZER;CN=${escapeICSText(`${profile.first_name} ${profile.last_name}`)}:mailto:${profile.email}`,
      icsAttendees,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const icsBase64 = btoa(icsContent);

    // Send confirmation email to candidate (only if send_invitation is true)
    if (send_invitation) {
      try {
        // Import email template
        const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

        const formattedDate = new Date(scheduled_start).toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: candidate_timezone,
        });

        const meetingDetails = [
          `<strong>Date & Time:</strong> ${formattedDate}`,
          `<strong>Duration:</strong> ${config.duration_minutes} minutes`,
          `<strong>Interviewer:</strong> ${profile.first_name} ${profile.last_name}`,
        ];

        if (googleMeetLink) {
          meetingDetails.push(`<strong>Join via:</strong> <a href="${googleMeetLink}" style="color: #7e3eff;">Google Meet</a>`);
        } else if (custom_meeting_location) {
          meetingDetails.push(`<strong>Location:</strong> ${custom_meeting_location}`);
        } else if (config.meeting_location) {
          meetingDetails.push(`<strong>Location:</strong> ${config.meeting_location}`);
        }

        let emailContent = `
          <p>Your interview with <strong>${profile.first_name} ${profile.last_name}</strong> has been confirmed!</p>
          <div class="divider"></div>
          <p><strong>Interview Details:</strong></p>
          ${formatEmailList(meetingDetails)}
          ${notes ? `<p style="margin-top: 16px;"><strong>Your notes:</strong><br/>${notes}</p>` : ''}
          <p style="margin-top: 24px;">A calendar invite is attached to this email. We recommend adding it to your calendar so you don't miss the interview.</p>
        `;

        const candidateEmailBody = createEmailTemplate({
          recipientName: candidate_name,
          preheaderText: `Your interview is confirmed for ${formattedDate}`,
          title: `Interview Confirmed: ${stageName}${jobTitle}`,
          content: emailContent,
          footerNote: 'If you need to reschedule, please contact us as soon as possible.'
        });

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
    } else {
      console.log('[create-booking] Skipping candidate email (send_invitation=false)');
    }

    // Send notification email to interviewer
    try {
      // Import email template (already imported above)
      const formattedDateInterviewer = new Date(scheduled_start).toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: config.timezone,
      });

      const candidateDetails = [
        `<strong>Name:</strong> ${candidate_name}`,
        `<strong>Email:</strong> <a href="mailto:${candidate_email}" style="color: #6366f1;">${candidate_email}</a>`,
      ];

      if (candidate_phone) {
        candidateDetails.push(`<strong>Phone:</strong> ${candidate_phone}`);
      }

      const interviewDetails = [
        `<strong>Date & Time:</strong> ${formattedDateInterviewer}`,
        `<strong>Duration:</strong> ${config.duration_minutes} minutes`,
      ];

      if (googleMeetLink) {
        interviewDetails.push(`<strong>Location:</strong> <a href="${googleMeetLink}" style="color: #6366f1;">Google Meet (Click to Join)</a>`);
      } else if (config.meeting_location) {
        interviewDetails.push(`<strong>Location:</strong> ${config.meeting_location}`);
      }

      const candidateNotificationNote = send_invitation 
        ? '' 
        : '<p style="margin-top: 16px; padding: 12px; background-color: #fef3c7; border-left: 4px solid: #f59e0b; color: #92400e;"><strong>Note:</strong> The candidate has not been notified yet. You may need to send them the interview details separately.</p>';

      let interviewerContent = `
        <p>A candidate has scheduled an interview with you!</p>
        ${candidateNotificationNote}
        <div class="divider"></div>
        <p><strong>Candidate Information:</strong></p>
        ${formatEmailList(candidateDetails)}
        <p style="margin-top: 24px;"><strong>Interview Details:</strong></p>
        ${formatEmailList(interviewDetails)}
        ${notes ? `<p style="margin-top: 24px;"><strong>Candidate Notes:</strong><br/>${notes}</p>` : ''}
        ${candidateProfileUrl ? `
          <div style="margin-top: 24px; padding: 16px; background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af;"><strong>📝 Submit Scorecard:</strong></p>
            <p style="margin: 8px 0 0 0;">
              <a href="${candidateProfileUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                View candidate profile and submit your scorecard →
              </a>
            </p>
          </div>
        ` : ''}
        <p style="margin-top: 24px;">The calendar invite is attached. ${googleEventId ? 'This interview has also been added to your Google Calendar.' : ''}</p>
      `;

      const interviewerEmailBody = createEmailTemplate({
        recipientName: profile.first_name,
        preheaderText: `New interview scheduled with ${candidate_name}`,
        title: `New Interview: ${stageName} with ${candidate_name}${jobTitle}`,
        content: interviewerContent,
        ctaText: candidateProfileUrl ? 'View Candidate Profile' : 'View in Dashboard',
        ctaUrl: candidateProfileUrl || `${frontendUrl}/settings`,
      });

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
