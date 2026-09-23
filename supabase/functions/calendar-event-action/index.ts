/**
 * calendar-event-action — one entry point for every calendar event action
 * triggered from the Calendar page (move, reschedule, confirm, resend, cancel).
 *
 * Google Calendar is the source of truth for attendees, so Google is updated
 * first; only when Google accepts the change do we write it to the database.
 */
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts';
import { getFreshCalendarAccessToken } from '../_shared/googleCalendarAuth.ts';
import { createEmailTemplate, formatEmailList } from '../_shared/emailTemplate.ts';

type Action = 'move' | 'reschedule' | 'confirm' | 'resend' | 'cancel';

interface Body {
  event_id?: string;
  action?: Action;
  new_start?: string;
  new_end?: string;
  notify_candidate?: boolean;
  notify_interviewers?: boolean;
  message?: string;
  reason?: string;
  requeue?: boolean;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function icsStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICS(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersFor(req.headers.get('Origin') ?? undefined);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as Body;
    const { event_id, action } = body;
    const notifyCandidate = body.notify_candidate !== false;
    const notifyInterviewers = body.notify_interviewers !== false;

    if (!event_id || !action) return json({ error: 'event_id and action are required' }, 400);
    if (!['move', 'reschedule', 'confirm', 'resend', 'cancel'].includes(action)) {
      return json({ error: `Unsupported action: ${action}` }, 400);
    }
    if ((action === 'move' || action === 'reschedule') && (!body.new_start || !body.new_end)) {
      return json({ error: 'new_start and new_end are required for this action' }, 400);
    }

    const { data: booking, error: bookingError } = await admin
      .from('scheduled_bookings')
      .select('*')
      .eq('id', event_id)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking) return json({ error: 'Event not found' }, 404);

    // ── Permission: host, scheduler, or an admin/owner of the tenant ──
    const { data: member } = await admin
      .from('members')
      .select('system_role, user_type')
      .eq('user_id', user.id)
      .eq('tenant_id', booking.tenant_id)
      .eq('user_status', 'active')
      .maybeSingle();

    const isAdmin =
      member?.system_role === 'admin' ||
      member?.user_type === 'workspace_owner' ||
      member?.user_type === 'platform_admin';
    const isOwnerOfEvent = booking.interviewer_id === user.id || booking.booked_by === user.id;

    if (!isAdmin && !isOwnerOfEvent) {
      return json({ error: 'You can only change events you host or scheduled.' }, 403);
    }

    // ── Google access token: the host's calendar, else the scheduler's ──
    let warning: string | undefined;
    let token = await getFreshCalendarAccessToken(admin as any, booking.interviewer_id ?? user.id);
    if (!token.accessToken && booking.booked_by && booking.booked_by !== booking.interviewer_id) {
      token = await getFreshCalendarAccessToken(admin as any, booking.booked_by);
      if (token.accessToken) warning = "The host hasn't connected Google — used the scheduler's calendar.";
    }
    if (!token.accessToken) {
      warning = token.errorMessage || 'Google Calendar is not connected, so Google was not updated.';
    }

    const sendUpdates = notifyCandidate && notifyInterviewers ? 'all' : 'none';
    const eventIds = [booking.google_event_id, booking.candidate_google_event_id].filter(Boolean) as string[];

    const gcal = async (path: string, init: RequestInit) => {
      const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`Google Calendar rejected the change [${res.status}]: ${text}`);
      }
      return res;
    };

    const timeZone = booking.candidate_timezone || 'UTC';
    const newStart = body.new_start ? new Date(body.new_start) : null;
    const newEnd = body.new_end ? new Date(body.new_end) : null;

    if (token.accessToken) {
      for (const gid of eventIds) {
        if (action === 'move' || action === 'reschedule') {
          await gcal(`/calendars/primary/events/${gid}?sendUpdates=${sendUpdates}`, {
            method: 'PATCH',
            body: JSON.stringify({
              start: { dateTime: newStart!.toISOString(), timeZone },
              end: { dateTime: newEnd!.toISOString(), timeZone },
            }),
          });
        } else if (action === 'confirm') {
          await gcal(
            `/calendars/primary/events/${gid}?sendUpdates=${sendUpdates}&conferenceDataVersion=1`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'confirmed',
                conferenceData: booking.google_meet_link
                  ? undefined
                  : {
                      createRequest: {
                        requestId: `gio-${booking.id}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                      },
                    },
              }),
            },
          );
        } else if (action === 'resend') {
          // An unchanged patch with sendUpdates makes Google re-issue the invite.
          await gcal(`/calendars/primary/events/${gid}?sendUpdates=all`, {
            method: 'PATCH',
            body: JSON.stringify({ start: { dateTime: new Date(booking.scheduled_start).toISOString(), timeZone } }),
          });
        } else if (action === 'cancel') {
          await gcal(`/calendars/primary/events/${gid}?sendUpdates=${sendUpdates}`, { method: 'DELETE' });
        }
      }
    }

    // ── Database ──
    const nowIso = new Date().toISOString();
    let update: Record<string, unknown> | null = null;

    if (action === 'move' || action === 'reschedule') {
      update = {
        scheduled_start: newStart!.toISOString(),
        scheduled_end: newEnd!.toISOString(),
        rescheduled_at: nowIso,
        last_synced_at: nowIso,
      };
    } else if (action === 'confirm') {
      update = { status: 'confirmed', last_synced_at: nowIso };
    } else if (action === 'cancel') {
      update = {
        status: 'cancelled',
        cancelled_at: nowIso,
        cancelled_by: user.id,
        cancellation_reason: body.reason ?? null,
        google_calendar_cancelled: !!token.accessToken,
      };
    }

    if (update) {
      const { error: updateError } = await admin
        .from('scheduled_bookings')
        .update(update)
        .eq('id', booking.id);
      if (updateError) throw updateError;
    }

    // ── Emails (branded, with ICS) ──
    const title = booking.candidate_name
      ? `Interview · ${booking.candidate_name}`
      : booking.notes || 'Interview';

    const { data: hostProfile } = booking.interviewer_id
      ? await admin
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', booking.interviewer_id)
          .maybeSingle()
      : { data: null as any };

    const effStart = newStart ?? new Date(booking.scheduled_start);
    const effEnd = newEnd ?? new Date(booking.scheduled_end);
    const when = effStart.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    });

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GoGio//Interview Scheduler//EN',
      'CALSCALE:GREGORIAN',
      `METHOD:${action === 'cancel' ? 'CANCEL' : 'REQUEST'}`,
      'BEGIN:VEVENT',
      `UID:${booking.ics_uid ?? booking.id}`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(effStart)}`,
      `DTEND:${icsStamp(effEnd)}`,
      `SUMMARY:${escapeICS(action === 'cancel' ? `CANCELLED: ${title}` : title)}`,
      ...(booking.candidate_email
        ? [`ATTENDEE;CN=${escapeICS(booking.candidate_name ?? '')};RSVP=TRUE:mailto:${booking.candidate_email}`]
        : []),
      action === 'cancel' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
      'SEQUENCE:1',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const icsBase64 = utf8ToBase64(ics);

    const headline =
      action === 'cancel'
        ? 'Interview cancelled'
        : action === 'confirm'
        ? 'Interview confirmed'
        : action === 'resend'
        ? 'Interview details'
        : 'Interview rescheduled';

    const details = [
      `<strong>Interview:</strong> ${title}`,
      `<strong>${action === 'cancel' ? 'Originally scheduled' : 'When'}:</strong> ${when}`,
      ...(body.reason ? [`<strong>Reason:</strong> ${body.reason}`] : []),
    ];

    const sendTo = async (to: string, recipientName: string) => {
      const html = createEmailTemplate({
        recipientName,
        preheaderText: `${headline}: ${when}`,
        title: headline,
        content: `
          <p>${
            action === 'cancel'
              ? 'This interview has been cancelled.'
              : action === 'resend'
              ? 'Here are the interview details again.'
              : 'The interview time has changed.'
          }</p>
          <div class="divider"></div>
          ${formatEmailList(details)}
          ${body.message ? `<p style="margin-top:20px;">${body.message}</p>` : ''}
        `,
      });
      await admin.functions.invoke('send-user-email', {
        body: {
          to: [to],
          subject: `${headline}: ${title}`,
          html,
          attachments: [
            {
              filename: action === 'cancel' ? 'cancellation.ics' : 'invite.ics',
              content: icsBase64,
              encoding: 'base64',
              contentType: 'text/calendar',
            },
          ],
        },
      });
    };

    // When only one group was ticked, Google notified nobody — Gio emails that
    // group itself, so people the user unticked are never contacted.
    const mustEmailOurselves = sendUpdates === 'none';
    if (mustEmailOurselves || !token.accessToken) {
      if (notifyCandidate && booking.candidate_email) {
        await sendTo(booking.candidate_email, booking.candidate_name ?? 'there');
      }
      if (notifyInterviewers && hostProfile?.email) {
        await sendTo(hostProfile.email, hostProfile.first_name ?? 'there');
      }
    }

    // ── Activity entry on the candidate ──
    if (booking.candidate_id) {
      const notified = [
        notifyCandidate ? 'candidate' : null,
        notifyInterviewers ? 'interviewers' : null,
      ].filter(Boolean);
      const activityType =
        action === 'cancel'
          ? 'interview_cancelled'
          : action === 'move' || action === 'reschedule'
          ? 'interview_rescheduled'
          : 'interview_scheduled';
      await admin.from('activities').insert({
        activity_type: activityType,
        title:
          action === 'cancel'
            ? 'Interview cancelled'
            : action === 'resend'
            ? 'Interview invite resent'
            : action === 'confirm'
            ? 'Interview slot confirmed'
            : 'Interview moved',
        description:
          action === 'move' || action === 'reschedule'
            ? `Moved to ${when}${notified.length ? ` · ${notified.join(' and ')} notified` : ' · no one notified'}`
            : `${when}${notified.length ? ` · ${notified.join(' and ')} notified` : ' · no one notified'}${
                body.reason ? ` · ${body.reason}` : ''
              }`,
        entity_type: 'candidate',
        entity_id: booking.candidate_id,
        user_id: user.id,
        tenant_id: booking.tenant_id,
        organization_id: booking.organization_id,
        metadata: { booking_id: booking.id, action },
      });
    }

    // ── Requeue for scheduling ──
    if (action === 'cancel' && body.requeue && booking.job_candidate_association_id) {
      await admin
        .from('job_candidate_associations')
        .update({ updated_at: nowIso })
        .eq('id', booking.job_candidate_association_id);
    }

    const { data: updated } = await admin
      .from('scheduled_bookings')
      .select('*')
      .eq('id', booking.id)
      .maybeSingle();

    return json({ success: true, booking: updated, warning });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error('[calendar-event-action] failed:', messageText);
    return json({ error: messageText }, 500);
  }
});
