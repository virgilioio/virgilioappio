import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";
import { getFreshCalendarAccessToken } from "../_shared/googleCalendarAuth.ts";

const corsHeaders = createSecureCorsHeaders();

interface RepairBody {
  booking_ids?: string[];
  user_id?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeName(profile: any) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || 'there';
}

async function getStageAndJob(supabase: any, booking: any) {
  let stageName = 'Interview';
  let jobTitle = '';

  if (booking.job_hiring_stage_id) {
    const { data } = await supabase
      .from('job_hiring_stages')
      .select('stage:job_stages(stage_name)')
      .eq('id', booking.job_hiring_stage_id)
      .maybeSingle();
    if (data?.stage?.stage_name) stageName = data.stage.stage_name;
  }

  if (booking.job_id) {
    const { data } = await supabase
      .from('jobs')
      .select('title')
      .eq('id', booking.job_id)
      .maybeSingle();
    if (data?.title) jobTitle = ` - ${data.title}`;
  }

  return { stageName, jobTitle };
}

async function repairOne(supabase: any, booking: any) {
  if (booking.google_event_id) {
    return { booking_id: booking.id, ok: true, skipped: true, reason: 'already_has_google_event' };
  }

  const token = await getFreshCalendarAccessToken(supabase, booking.interviewer_id);
  if (!token.accessToken || !token.calendarIdentity) {
    return {
      booking_id: booking.id,
      ok: false,
      error: token.errorMessage || 'Google Calendar is not connected.',
      code: token.errorCode || 'calendar_unavailable',
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, email, first_name, last_name')
    .eq('user_id', booking.interviewer_id)
    .maybeSingle();
  if (profileError || !profile?.email) {
    return { booking_id: booking.id, ok: false, error: 'Interviewer profile not found' };
  }

  const { data: config } = await supabase
    .from('booking_configurations')
    .select('timezone, meeting_location, duration_minutes')
    .eq('id', booking.booking_config_id)
    .maybeSingle();

  const { data: attendeeRows } = await supabase
    .from('scheduled_booking_attendees')
    .select('user_id')
    .eq('booking_id', booking.id);
  const attendeeUserIds = (attendeeRows ?? [])
    .map((row: { user_id: string | null }) => row.user_id)
    .filter((id: string | null) => id && id !== booking.interviewer_id);
  const { data: coProfiles } = attendeeUserIds.length > 0
    ? await supabase.from('profiles').select('user_id, email, first_name, last_name').in('user_id', attendeeUserIds)
    : { data: [] };

  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.gogio.io';
  const candidateProfileUrl = booking.job_id && booking.candidate_id
    ? `${frontendUrl}/jobs/${booking.job_id}?candidate=${booking.candidate_id}`
    : null;
  const { stageName, jobTitle } = await getStageAndJob(supabase, booking);
  const interviewTitle = booking.job_id || booking.job_hiring_stage_id
    ? `${stageName} with ${booking.candidate_name}${jobTitle}`
    : `Interview with ${booking.candidate_name}`;
  const timezone = config?.timezone || 'UTC';
  const guestEmails = Array.isArray(booking.guest_emails) ? booking.guest_emails : [];

  const interviewerEventResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=externalOnly',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Interview: ${booking.candidate_name}`,
        description: `Interview scheduled via GoGio\n\nCANDIDATE DETAILS:\nName: ${booking.candidate_name}\nEmail: ${booking.candidate_email}${booking.candidate_phone ? `\nPhone: ${booking.candidate_phone}` : ''}${booking.notes ? `\n\nNOTES:\n${booking.notes}` : ''}${candidateProfileUrl ? `\n\nSUBMIT SCORECARD:\n${candidateProfileUrl}` : ''}${booking.transcript_ingest_email ? `\n\nTRANSCRIPT EMAIL:\n${booking.transcript_ingest_email}\n(Add this to your note-taking app to auto-generate interview notes)` : ''}`,
        start: { dateTime: booking.scheduled_start, timeZone: timezone },
        end: { dateTime: booking.scheduled_end, timeZone: timezone },
        attendees: [
          { email: profile.email },
          ...(coProfiles ?? []).filter((p: any) => p.email && p.email !== profile.email).map((p: any) => ({ email: p.email })),
          ...(booking.transcript_ingest_email ? [{ email: booking.transcript_ingest_email, responseStatus: 'accepted' }] : []),
          ...guestEmails.map((email: string) => ({ email })),
        ],
        conferenceData: booking.meeting_type === 'google_meet' ? {
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
    },
  );

  if (!interviewerEventResponse.ok) {
    const details = await interviewerEventResponse.text();
    const syncErrors = Array.isArray(booking.sync_errors) ? booking.sync_errors : [];
    await supabase
      .from('scheduled_bookings')
      .update({
        sync_errors: [...syncErrors, {
          at: new Date().toISOString(),
          source: 'repair-booking-calendar-events',
          code: 'calendar_event_creation_failed',
          message: `Google returned ${interviewerEventResponse.status}: ${details}`,
        }],
      })
      .eq('id', booking.id);
    return { booking_id: booking.id, ok: false, error: details, status: interviewerEventResponse.status };
  }

  const interviewerEvent = await interviewerEventResponse.json();
  const googleEventId = interviewerEvent.id as string;
  const googleMeetLink = interviewerEvent.hangoutLink || interviewerEvent.conferenceData?.entryPoints?.[0]?.uri || null;
  const conferenceData = interviewerEvent.conferenceData;

  let candidateGoogleEventId: string | null = null;
  if (booking.candidate_email && googleMeetLink) {
    const candidateEventResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=externalOnly',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: interviewTitle,
          description: `You have an interview scheduled with ${safeName(profile)}.\n\nJoin via Google Meet: ${googleMeetLink}${booking.notes ? `\n\nAdditional information:\n${booking.notes}` : ''}`,
          start: { dateTime: booking.scheduled_start, timeZone: booking.candidate_timezone || timezone },
          end: { dateTime: booking.scheduled_end, timeZone: booking.candidate_timezone || timezone },
          attendees: [{ email: booking.candidate_email }],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 },
              { method: 'popup', minutes: 30 },
            ],
          },
          ...(conferenceData && { conferenceData }),
        }),
      },
    );

    if (candidateEventResponse.ok) {
      const candidateEvent = await candidateEventResponse.json();
      candidateGoogleEventId = candidateEvent.id as string;
    } else {
      console.error('[repair-booking-calendar-events] Candidate event failed:', candidateEventResponse.status, await candidateEventResponse.text());
    }
  }

  const { error: updateError } = await supabase
    .from('scheduled_bookings')
    .update({
      google_event_id: googleEventId,
      candidate_google_event_id: candidateGoogleEventId,
      google_meet_link: googleMeetLink,
      meeting_location: googleMeetLink || booking.meeting_location,
      last_synced_at: new Date().toISOString(),
      sync_source: 'google_calendar',
      sync_errors: [],
    })
    .eq('id', booking.id);
  if (updateError) throw updateError;

  return {
    booking_id: booking.id,
    ok: true,
    skipped: false,
    google_event_id: googleEventId,
    candidate_google_event_id: candidateGoogleEventId,
    google_meet_link: googleMeetLink,
  };
}

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as RepairBody;
    const bookingIds = (body.booking_ids ?? []).filter(isUuid);
    const targetUserId = isUuid(body.user_id) ? body.user_id : null;
    if (bookingIds.length === 0 && !targetUserId) {
      return json({ error: 'Provide booking_ids or user_id' }, 400);
    }

    let actorUserId: string | null = null;
    let authorized = token === serviceKey;
    if (!authorized) {
      const { data: userData } = await supabase.auth.getUser(token);
      actorUserId = userData.user?.id ?? null;
      authorized = !!actorUserId && (!targetUserId || actorUserId === targetUserId);
    }
    if (!authorized) return json({ error: 'Unauthorized' }, 401);

    let query = supabase
      .from('scheduled_bookings')
      .select('*')
      .eq('status', 'confirmed')
      .is('google_event_id', null);

    if (bookingIds.length > 0) query = query.in('id', bookingIds);
    if (targetUserId) query = query.eq('interviewer_id', targetUserId).gte('scheduled_end', new Date().toISOString());
    if (!authorized || (!targetUserId && actorUserId)) query = query.eq('interviewer_id', actorUserId);

    const { data: bookings, error: fetchError } = await query.order('scheduled_start', { ascending: true }).limit(50);
    if (fetchError) throw fetchError;

    const results = [];
    for (const booking of bookings ?? []) {
      try {
        results.push(await repairOne(supabase, booking));
      } catch (error) {
        results.push({
          booking_id: booking.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json({
      success: results.every((result) => result.ok),
      total: results.length,
      repaired: results.filter((result) => result.ok && !result.skipped).length,
      skipped: results.filter((result) => result.skipped).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[repair-booking-calendar-events] Error:', message);
    return json({ error: message }, 500);
  }
});