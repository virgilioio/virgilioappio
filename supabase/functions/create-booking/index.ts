import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DayConfig { enabled: boolean; start: string; end: string }
type WeeklySchedule = Record<string, DayConfig>;

function getWallClockInTz(date: Date, tz: string): { dayName: string; minutesFromMidnight: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  let hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  if (hour === 24) hour = 0;
  const dayMap: Record<string, string> = {
    Sun: 'sunday', Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday',
    Thu: 'thursday', Fri: 'friday', Sat: 'saturday',
  };
  return { dayName: dayMap[weekday] || weekday.toLowerCase(), minutesFromMidnight: hour * 60 + minute };
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface ValidationParams {
  scheduledStart: Date;
  scheduledEnd: Date;
  effectiveTimezone: string;
  effectiveSchedule: WeeklySchedule;
  effectiveBuffer: number;
  effectiveMinNotice: number;
  effectiveMaxDays: number;
  effectiveDuration: number;
}

function validateRequestedSlot(p: ValidationParams): { ok: true } | { ok: false; code: string; message: string } {
  const { scheduledStart, scheduledEnd, effectiveTimezone, effectiveSchedule,
    effectiveBuffer, effectiveMinNotice, effectiveMaxDays, effectiveDuration } = p;

  if (isNaN(scheduledStart.getTime()) || isNaN(scheduledEnd.getTime())) {
    return { ok: false, code: 'SLOT_INVALID', message: 'Invalid scheduled_start or scheduled_end.' };
  }

  const actualDurationMin = (scheduledEnd.getTime() - scheduledStart.getTime()) / 60000;
  if (Math.abs(actualDurationMin - effectiveDuration) > 1) {
    return { ok: false, code: 'SLOT_DURATION_MISMATCH',
      message: `Slot duration (${actualDurationMin}min) does not match event duration (${effectiveDuration}min).` };
  }

  const now = new Date();
  const minStart = new Date(now.getTime() + effectiveMinNotice * 60 * 60 * 1000);
  if (scheduledStart < minStart) {
    return { ok: false, code: 'SLOT_TOO_SOON',
      message: `Bookings require at least ${effectiveMinNotice} hours notice.` };
  }

  const maxStart = new Date(now.getTime() + effectiveMaxDays * 24 * 60 * 60 * 1000);
  if (scheduledStart > maxStart) {
    return { ok: false, code: 'SLOT_TOO_FAR',
      message: `Bookings cannot be scheduled more than ${effectiveMaxDays} days ahead.` };
  }

  const { dayName, minutesFromMidnight: startMin } = getWallClockInTz(scheduledStart, effectiveTimezone);
  const dayConfig = effectiveSchedule?.[dayName];
  if (!dayConfig || !dayConfig.enabled) {
    return { ok: false, code: 'SLOT_OUTSIDE_SCHEDULE',
      message: `The host is not available on ${dayName}.` };
  }

  const dayStart = parseHHMM(dayConfig.start);
  const dayEnd = parseHHMM(dayConfig.end);
  const endTzInfo = getWallClockInTz(scheduledEnd, effectiveTimezone);
  const endMin = endTzInfo.dayName === dayName ? endTzInfo.minutesFromMidnight : dayEnd + 1;

  if (startMin < dayStart || endMin > dayEnd) {
    return { ok: false, code: 'SLOT_OUTSIDE_SCHEDULE',
      message: `Slot is outside the host's working hours (${dayConfig.start}–${dayConfig.end} ${effectiveTimezone}).` };
  }

  const stride = effectiveDuration + (effectiveBuffer || 0);
  if (stride > 0) {
    const offset = startMin - dayStart;
    if (offset % stride !== 0) {
      return { ok: false, code: 'SLOT_NOT_ALIGNED',
        message: `Slot does not align with the available time grid.` };
    }
  }

  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Defensive parse: surface clear 400 (with logs) instead of an unhandled SyntaxError
    let payload: any;
    try {
      payload = await req.json();
    } catch (parseErr) {
      console.error(
        '[create-booking] Invalid/empty JSON body. content-length=',
        req.headers.get('content-length'),
        'content-type=',
        req.headers.get('content-type'),
        'err=',
        (parseErr as Error)?.message,
      );
      return new Response(JSON.stringify({ error: 'Empty or invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      booking_config_id,
      booking_config_ids = null, // Group booking: array of config IDs (AND mode)
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
      // Event type for slot validation overrides
      event_type_id = null,
      // Meeting location preferences
      meeting_type_preference = 'google_meet', // 'google_meet' or 'custom'
      custom_meeting_location = null,
      // Per-booking custom event title override (takes priority over config default)
      custom_event_title = null,
      // Guest emails for additional attendees
      guest_emails = [],
      // Reschedule support: cancel old booking atomically
      reschedule_booking_id = null,
      reschedule_token = null,
    } = payload;

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

    // VALIDATION: Always resolve and use the correct association ID based on candidate_id + job_id
    let validatedAssociationId = job_candidate_association_id;

    if (job_id && candidate_id) {
      const { data: correctAssociation } = await supabase
        .from('job_candidate_associations')
        .select('id')
        .eq('job_id', job_id)
        .eq('candidate_id', candidate_id)
        .eq('status', 'active')
        .maybeSingle();

      if (correctAssociation) {
        if (job_candidate_association_id && job_candidate_association_id !== correctAssociation.id) {
          console.error(
            `[create-booking] CRITICAL: Association mismatch! ` +
            `Passed: ${job_candidate_association_id}, Correct: ${correctAssociation.id}. ` +
            `Candidate: ${candidate_id}, Job: ${job_id}. Using correct association.`
          );
        }
        validatedAssociationId = correctAssociation.id;
      } else {
        console.warn(
          `[create-booking] No active association found for candidate ${candidate_id} / job ${job_id}. ` +
          `Using passed association ${job_candidate_association_id || 'null'}`
        );
      }
    }

    // Fetch stage name and job title if this is an internal booking
    let stageName = 'Interview';
    let jobTitle = '';
    let isJobSpecificBooking = false;

    if (job_hiring_stage_id) {
      isJobSpecificBooking = true;
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
      isJobSpecificBooking = true;
      const { data: jobData } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', job_id)
        .single();
      
      if (jobData?.title) {
        jobTitle = ` - ${jobData.title}`;
      }
    }

    // ==========================================================
    // GROUP BOOKING resolution: when booking_config_ids is passed,
    // validate every config is active and pick a deterministic primary.
    // ==========================================================
    const isGroupBooking = Array.isArray(booking_config_ids) && booking_config_ids.length > 1;
    let groupConfigs: any[] = [];
    let groupAttendeeProfiles: Array<{ user_id: string; email: string; first_name: string; last_name: string }> = [];
    let primaryBookingConfigId: string = booking_config_id;

    if (isGroupBooking) {
      const { data: gConfigs, error: gErr } = await supabase
        .from('booking_configurations')
        .select('*')
        .in('id', booking_config_ids)
        .eq('is_active', true);

      if (gErr || !gConfigs || gConfigs.length !== booking_config_ids.length) {
        console.error('[create-booking] Group config lookup failed or incomplete:', gErr, 'expected', booking_config_ids.length, 'got', gConfigs?.length);
        return new Response(JSON.stringify({
          error: 'One or more interviewer booking configurations are unavailable.',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      groupConfigs = gConfigs;
      // Deterministic primary: first id in the array passed by the client
      primaryBookingConfigId = booking_config_ids[0];

      const userIds = groupConfigs.map(c => c.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name')
        .in('user_id', userIds);
      groupAttendeeProfiles = (profilesData || []) as any;

      console.log('[create-booking] Group booking with', groupConfigs.length, 'interviewers. Primary:', primaryBookingConfigId);
    }

    // Load PRIMARY booking config (single-host or group primary)
    const { data: config, error: configError } = await supabase
      .from('booking_configurations')
      .select('*')
      .eq('id', primaryBookingConfigId)
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

    // ============================================================
    // SLOT VALIDATION — authoritative server-side guard.
    // Bypassed only for internal scheduling (recruiter manually books).
    // ============================================================
    const isInternalScheduling = !!booked_by_user_id;
    if (!isInternalScheduling) {
      let eventType: any = null;
      if (event_type_id) {
        const { data: et } = await supabase
          .from('booking_event_types')
          .select('*')
          .eq('id', event_type_id)
          .eq('booking_config_id', booking_config_id)
          .eq('is_active', true)
          .maybeSingle();
        eventType = et;
        if (!eventType) {
          console.warn('[create-booking] event_type_id provided but not found/active:', event_type_id);
        }
      }

      const effectiveTimezone = eventType?.timezone || config.timezone;
      const effectiveSchedule = (eventType?.weekly_schedule || config.weekly_schedule) as WeeklySchedule;
      const effectiveBuffer = eventType?.buffer_time_minutes ?? config.buffer_time_minutes ?? 0;
      const effectiveMinNotice = eventType?.min_notice_hours ?? config.min_notice_hours ?? 24;
      const effectiveMaxDays = eventType?.max_days_ahead ?? config.max_days_ahead ?? 30;
      const effectiveDuration = eventType?.duration_minutes ?? config.duration_minutes;

      const validation = validateRequestedSlot({
        scheduledStart: new Date(scheduled_start),
        scheduledEnd: new Date(scheduled_end),
        effectiveTimezone,
        effectiveSchedule,
        effectiveBuffer,
        effectiveMinNotice,
        effectiveMaxDays,
        effectiveDuration,
      });

      if (!validation.ok) {
        console.warn('[create-booking] Slot validation rejected:', validation.code, validation.message, {
          scheduled_start, scheduled_end, effectiveTimezone, effectiveDuration,
          effectiveBuffer, effectiveMinNotice, effectiveMaxDays,
          event_type_id, booking_config_id,
        });
        return new Response(JSON.stringify({
          error: validation.message,
          code: validation.code,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[create-booking] Slot validated against', eventType ? 'event type' : 'config', 'rules.');
    } else {
      console.log('[create-booking] Internal scheduling — skipping slot validation.');
    }

    // Generate interview title based on booking type
    let interviewTitle: string;
    if (isJobSpecificBooking) {
      // Job+stage specific booking - use contextual title
      interviewTitle = `${stageName} with ${candidate_name}${jobTitle}`;
    } else {
      // Generic booking - priority: request override > config default > fallback
      const titleTemplate = custom_event_title || config.custom_event_title || 'Interview with {candidate_name}';
      interviewTitle = titleTemplate.replace(/{candidate_name}/g, candidate_name);
    }
    console.log('[create-booking] Interview title:', interviewTitle, '(job-specific:', isJobSpecificBooking, ', custom_event_title provided:', !!custom_event_title, ')');

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

    // Resolve booker email (recruiter who manually scheduled). Included as
    // attendee on the interviewer event so they see the meeting on their own calendar.
    let bookerEmail: string | null = null;
    if (booked_by_user_id) {
      const { data: bookerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', booked_by_user_id)
        .maybeSingle();
      const candidateEmail = bookerProfile?.email?.toLowerCase() || null;
      const interviewerEmails = new Set<string>([
        profile.email.toLowerCase(),
        ...groupAttendeeProfiles.map(p => p.email?.toLowerCase()).filter(Boolean) as string[],
      ]);
      if (candidateEmail && !interviewerEmails.has(candidateEmail)) {
        bookerEmail = bookerProfile!.email;
      }
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

    // If rescheduling, cancel the old booking first
    if (reschedule_booking_id) {
      console.log('[create-booking] Rescheduling: cancelling old booking', reschedule_booking_id);

      // Validate token if provided (public reschedule)
      if (reschedule_token) {
        const { data: tokenData } = await supabase
          .from('booking_link_tokens')
          .select('candidate_id, jhs_id')
          .eq('token', reschedule_token)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (!tokenData) {
          return new Response(JSON.stringify({ error: 'Invalid or expired reschedule token' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Fetch old booking
      const { data: oldBooking } = await supabase
        .from('scheduled_bookings')
        .select('id, google_event_id, candidate_google_event_id, interviewer_id, status')
        .eq('id', reschedule_booking_id)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (oldBooking) {
        // Delete old Google Calendar events if they exist
        if (oldBooking.google_event_id && accessToken) {
          try {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${oldBooking.google_event_id}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (oldBooking.candidate_google_event_id) {
              await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${oldBooking.candidate_google_event_id}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
              );
            }
            console.log('[create-booking] Old calendar events deleted');
          } catch (calErr) {
            console.error('[create-booking] Error deleting old calendar events:', calErr);
          }
        }

        // Mark old booking as cancelled
        await supabase
          .from('scheduled_bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'Rescheduled by candidate',
          })
          .eq('id', reschedule_booking_id);

        console.log('[create-booking] Old booking cancelled for reschedule');
      }
    }

    // Check if slot is still available across ALL involved configs (group-aware).
    // Strict overlap (existing_start < new_end AND existing_end > new_start). Back-to-back is OK.
    const conflictConfigIds = isGroupBooking ? booking_config_ids : [booking_config_id];
    const { data: conflictingBookings } = await supabase
      .from('scheduled_bookings')
      .select('id, booking_config_id')
      .in('booking_config_id', conflictConfigIds)
      .eq('status', 'confirmed')
      .lt('scheduled_start', scheduled_end)
      .gt('scheduled_end', scheduled_start)
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
    // Only generate for job-specific bookings (not simple/generic bookings)
    const generateIngestCode = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    
    // Simple bookings (Calendly-like) don't get transcript ingest
    const transcriptIngestCode = isJobSpecificBooking ? generateIngestCode() : null;
    const transcriptIngestEmail = isJobSpecificBooking ? `int_${transcriptIngestCode}@ingest.gogio.io` : null;
    console.log('[create-booking] Transcript ingest:', isJobSpecificBooking ? transcriptIngestEmail : 'disabled (simple booking)');

    if (!accessToken || !calendarIdentity) {
      console.warn('[create-booking] No interviewer OAuth token or calendar identity — skipping Google Calendar event creation. Ingest email will NOT be on the invite. accessToken present:', !!accessToken, 'calendarIdentity present:', !!calendarIdentity);
    }

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
              description: `Interview scheduled via GoGio\n\nCANDIDATE DETAILS:\nName: ${candidate_name}\nEmail: ${candidate_email}${candidate_phone ? `\nPhone: ${candidate_phone}` : ''}${notes ? `\n\nNOTES:\n${notes}` : ''}${meeting_type_preference === 'custom' && custom_meeting_location ? `\n\nMEETING LOCATION:\n${custom_meeting_location}` : ''}${candidateProfileUrl ? `\n\n📝 SUBMIT SCORECARD:\n${candidateProfileUrl}` : ''}${transcriptIngestEmail ? `\n\n🎙️ TRANSCRIPT EMAIL:\n${transcriptIngestEmail}\n(Add this to your note-taking app to auto-generate interview notes)` : ''}`,
              start: {
                dateTime: scheduled_start,
                timeZone: config.timezone,
              },
              end: {
                dateTime: scheduled_end,
                timeZone: config.timezone,
              },
              attendees: [
                { email: profile.email }, // Primary interviewer
                // Additional group interviewers (excluding primary)
                ...(isGroupBooking
                  ? groupAttendeeProfiles
                      .filter(p => p.email && p.email !== profile.email)
                      .map(p => ({ email: p.email }))
                  : []),
                // Only add transcript ingest for job-specific bookings
                ...(transcriptIngestEmail ? [{ email: transcriptIngestEmail, responseStatus: 'accepted' }] : []),
                // Add guest emails as attendees
                ...(guest_emails || []).map((ge: string) => ({ email: ge })),
                // Booker (recruiter who manually scheduled), so it shows on their calendar
                ...(bookerEmail ? [{ email: bookerEmail, responseStatus: 'accepted' }] : []),
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

          // Re-assert ingest attendee acceptance via PATCH (Google sometimes downgrades responseStatus on insert)
          if (transcriptIngestEmail && googleEventId) {
            try {
              const patchResponse = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=externalOnly`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    attendees: [
                      { email: profile.email },
                      ...(isGroupBooking
                        ? groupAttendeeProfiles
                            .filter(p => p.email && p.email !== profile.email)
                            .map(p => ({ email: p.email }))
                        : []),
                      { email: transcriptIngestEmail, responseStatus: 'accepted' },
                      ...(guest_emails || []).map((ge: string) => ({ email: ge })),
                    ],
                  }),
                }
              );
              if (!patchResponse.ok) {
                const patchErr = await patchResponse.text();
                console.warn('[create-booking] Ingest acceptance PATCH failed:', patchResponse.status, patchErr);
              } else {
                console.log('[create-booking] Re-asserted ingest email acceptance via PATCH');
              }
            } catch (patchEx) {
              console.warn('[create-booking] Ingest acceptance PATCH threw:', patchEx);
            }
          }

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
        booking_config_id: primaryBookingConfigId,
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
        // Internal booking context (using validated association ID)
        candidate_id: candidate_id || null,
        job_id: job_id || null,
        job_candidate_association_id: validatedAssociationId || null,
        job_hiring_stage_id: job_hiring_stage_id || null,
        booked_by: booked_by_user_id || null,
        // Transcript ingest
        transcript_ingest_code: transcriptIngestCode,
        transcript_ingest_email: transcriptIngestEmail,
        // Guest emails
        guest_emails: guest_emails && guest_emails.length > 0 ? guest_emails : [],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('[create-booking] Booking created successfully:', booking.id);

    // Insert group attendees (one row per interviewer including primary)
    if (isGroupBooking && groupConfigs.length > 0) {
      const attendeeRows = groupConfigs.map((c: any) => ({
        booking_id: booking.id,
        user_id: c.user_id,
        role: 'interviewer' as const,
      }));
      const { error: attendeesError } = await supabase
        .from('scheduled_booking_attendees')
        .insert(attendeeRows);
      if (attendeesError) {
        console.error('[create-booking] Failed to insert group attendees:', attendeesError);
      } else {
        console.log('[create-booking] Inserted', attendeeRows.length, 'group attendees');
      }
    }

    // Generate ICS file content
    const formatDateForICS = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeICSText = (text: string): string => {
      return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    // Helper: format names list as "Alice, Bob & Carol"
    const formatNamesList = (names: string[]): string => {
      const filtered = names.filter(Boolean);
      if (filtered.length === 0) return '';
      if (filtered.length === 1) return filtered[0];
      if (filtered.length === 2) return `${filtered[0]} & ${filtered[1]}`;
      return `${filtered.slice(0, -1).join(', ')} & ${filtered[filtered.length - 1]}`;
    };

    // Build interviewer display strings (used for both ICS and emails below)
    const allInterviewerNames = isGroupBooking
      ? [`${profile.first_name} ${profile.last_name}`, ...groupAttendeeProfiles
          .filter(p => p.user_id !== profile.user_id)
          .map(p => `${p.first_name} ${p.last_name}`)]
      : [`${profile.first_name} ${profile.last_name}`];
    const interviewersDisplay = formatNamesList(allInterviewerNames);

    // Only include candidate in ICS if send_invitation is true
    const icsAttendees = [
      ...(send_invitation 
        ? [`ATTENDEE;CN=${escapeICSText(candidate_name)};RSVP=TRUE:mailto:${candidate_email}`]
        : []),
      ...(isGroupBooking
        ? groupAttendeeProfiles
            .filter(p => p.user_id !== profile.user_id && p.email)
            .map(p => `ATTENDEE;CN=${escapeICSText(`${p.first_name} ${p.last_name}`)};RSVP=TRUE:mailto:${p.email}`)
        : []),
      ...(guest_emails || []).map((ge: string) => `ATTENDEE;RSVP=TRUE:mailto:${ge}`),
    ].join('\r\n');
    const icsAttendeesLine = icsAttendees ? icsAttendees + '\r\n' : '';

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
      icsAttendeesLine,
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
          `<strong>${isGroupBooking ? 'Interviewers' : 'Interviewer'}:</strong> ${interviewersDisplay}`,
        ];

        if (googleMeetLink) {
          meetingDetails.push(`<strong>Join via:</strong> <a href="${googleMeetLink}" style="color: #7e3eff;">Google Meet</a>`);
        } else if (custom_meeting_location) {
          meetingDetails.push(`<strong>Location:</strong> ${custom_meeting_location}`);
        } else if (config.meeting_location) {
          meetingDetails.push(`<strong>Location:</strong> ${config.meeting_location}`);
        }

        let emailContent = `
          <p>Your interview with <strong>${interviewersDisplay}</strong> has been confirmed!</p>
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

    // Send notification email to interviewer(s)
    try {
      const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');
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

      const candidateNotificationNote = send_invitation 
        ? '' 
        : '<p style="margin-top: 16px; padding: 12px; background-color: #fef3c7; border-left: 4px solid: #f59e0b; color: #92400e;"><strong>Note:</strong> The candidate has not been notified yet. You may need to send them the interview details separately.</p>';

      // Build the recipient list. Primary first, then group attendees (de-duped, with email).
      type InterviewerRecipient = { email: string; first_name: string; last_name: string; user_id: string };
      const interviewerRecipients: InterviewerRecipient[] = isGroupBooking
        ? [
            { email: profile.email, first_name: profile.first_name, last_name: profile.last_name, user_id: profile.user_id },
            ...groupAttendeeProfiles
              .filter(p => p.user_id !== profile.user_id && p.email)
              .map(p => ({ email: p.email, first_name: p.first_name, last_name: p.last_name, user_id: p.user_id })),
          ]
        : [{ email: profile.email, first_name: profile.first_name, last_name: profile.last_name, user_id: profile.user_id }];

      for (const recipient of interviewerRecipients) {
        const interviewDetails = [
          `<strong>Date & Time:</strong> ${formattedDateInterviewer}`,
          `<strong>Duration:</strong> ${config.duration_minutes} minutes`,
        ];

        if (isGroupBooking) {
          const coInterviewerNames = allInterviewerNames.filter(
            n => n !== `${recipient.first_name} ${recipient.last_name}`
          );
          if (coInterviewerNames.length > 0) {
            interviewDetails.push(`<strong>Co-interviewers:</strong> ${formatNamesList(coInterviewerNames)}`);
          }
        }

        if (googleMeetLink) {
          interviewDetails.push(`<strong>Location:</strong> <a href="${googleMeetLink}" style="color: #6366f1;">Google Meet (Click to Join)</a>`);
        } else if (config.meeting_location) {
          interviewDetails.push(`<strong>Location:</strong> ${config.meeting_location}`);
        }

        const interviewerContent = `
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
          recipientName: recipient.first_name,
          preheaderText: `New interview scheduled with ${candidate_name}`,
          title: `New Interview: ${stageName} with ${candidate_name}${jobTitle}`,
          content: interviewerContent,
          ctaText: candidateProfileUrl ? 'View Candidate Profile' : 'View in Dashboard',
          ctaUrl: candidateProfileUrl || `${frontendUrl}/settings`,
        });

        await supabase.functions.invoke('send-user-email', {
          body: {
            from_email: 'noreply@app.gogio.io',
            to: [recipient.email],
            subject: `New Interview Scheduled: ${stageName} with ${candidate_name}${jobTitle}`,
            body_html: interviewerEmailBody,
            attachments: [{
              filename: 'interview.ics',
              content: icsBase64,
              content_type: 'text/calendar',
            }],
          },
        });
      }

      console.log('[create-booking] Interviewer notification email(s) sent to', interviewerRecipients.length, 'recipient(s)');
    } catch (emailError) {
      console.error('[create-booking] Failed to send interviewer email:', emailError);
    }

    // Send ICS invite emails to guests
    if (guest_emails && guest_emails.length > 0) {
      try {
        const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');

        const formattedDateGuest = new Date(scheduled_start).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: candidate_timezone,
        });

        const guestMeetingDetails = [
          `<strong>Date & Time:</strong> ${formattedDateGuest}`,
          `<strong>Duration:</strong> ${config.duration_minutes} minutes`,
          `<strong>Candidate:</strong> ${candidate_name}`,
          `<strong>Interviewer:</strong> ${profile.first_name} ${profile.last_name}`,
        ];

        if (googleMeetLink) {
          guestMeetingDetails.push(`<strong>Join via:</strong> <a href="${googleMeetLink}" style="color: #7e3eff;">Google Meet</a>`);
        } else if (custom_meeting_location) {
          guestMeetingDetails.push(`<strong>Location:</strong> ${custom_meeting_location}`);
        } else if (config.meeting_location) {
          guestMeetingDetails.push(`<strong>Location:</strong> ${config.meeting_location}`);
        }

        const guestEmailContent = `
          <p>You've been invited to an interview.</p>
          <div class="divider"></div>
          <p><strong>Interview Details:</strong></p>
          ${formatEmailList(guestMeetingDetails)}
          ${notes ? `<p style="margin-top: 16px;"><strong>Notes:</strong><br/>${notes}</p>` : ''}
          <p style="margin-top: 24px;">A calendar invite is attached to this email.</p>
        `;

        for (const guestEmail of guest_emails) {
          try {
            const guestEmailBody = createEmailTemplate({
              recipientName: 'there',
              preheaderText: `Interview invite for ${formattedDateGuest}`,
              title: `Interview Invite: ${stageName}${jobTitle}`,
              content: guestEmailContent,
            });

            await supabase.functions.invoke('send-user-email', {
              body: {
                to: [guestEmail],
                subject: `Interview Invite: ${stageName} with ${candidate_name}${jobTitle}`,
                body_html: guestEmailBody,
                attachments: [{
                  filename: 'interview.ics',
                  content: icsBase64,
                  content_type: 'text/calendar',
                }],
              },
            });
            console.log('[create-booking] Guest email sent to:', guestEmail);
          } catch (guestError) {
            console.error('[create-booking] Failed to send guest email to', guestEmail, ':', guestError);
          }
        }
      } catch (guestSetupError) {
        console.error('[create-booking] Failed to set up guest emails:', guestSetupError);
      }
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
