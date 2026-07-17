// update-booking-attendee: Update the candidate attendee email on an existing
// Google Calendar event and resend the invite. Interviewers/time/location untouched.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts';

interface Body {
  booking_id?: string;
  new_email?: string;
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getFreshAccessToken(supabase: any, interviewerId: string): Promise<string | null> {
  const { data: calIdentity } = await supabase
    .from('calendar_identities')
    .select('*')
    .eq('user_id', interviewerId)
    .eq('is_active', true)
    .single();
  if (!calIdentity) return null;

  let accessToken = calIdentity.access_token as string;
  const now = new Date();
  const expiresAt = new Date(calIdentity.token_expires_at);
  if (expiresAt > now) return accessToken;

  const { data: decryptedToken } = await supabase.rpc('decrypt_refresh_token', {
    encrypted_token: calIdentity.encrypted_refresh_token,
  });
  if (!decryptedToken) return accessToken || null;

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return accessToken || null;
  const refreshData = await res.json();
  accessToken = refreshData.access_token;
  await supabase
    .from('calendar_identities')
    .update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
    })
    .eq('id', calIdentity.id);
  return accessToken;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersFor(req.headers.get('Origin') ?? undefined);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    const bookingId = (body.booking_id ?? '').trim();
    const newEmail = (body.new_email ?? '').trim();

    if (!bookingId) return json({ error: 'booking_id is required' }, 400);
    if (!newEmail || !emailRe.test(newEmail) || newEmail.length > 255) {
      return json({ error: 'A valid new_email is required' }, 400);
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('scheduled_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    if (fetchErr || !booking) return json({ error: 'Booking not found' }, 404);
    if (booking.status === 'cancelled') return json({ error: 'Booking is cancelled' }, 400);

    const oldEmail = (booking.candidate_email ?? '').trim();
    if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
      return json({ error: 'New email is the same as the current one' }, 400);
    }

    if (!booking.google_event_id) {
      // No Google event to patch — just update the row.
      const { error: updErr } = await supabase
        .from('scheduled_bookings')
        .update({ candidate_email: newEmail })
        .eq('id', bookingId);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ success: true, new_email: newEmail, google_updated: false });
    }

    // Try to reach Google via the interviewer's identity.
    const interviewerId = booking.interviewer_id as string | null;
    if (!interviewerId) {
      return json({ error: 'No interviewer identity available to update Google Calendar' }, 400);
    }
    const accessToken = await getFreshAccessToken(supabase, interviewerId);
    if (!accessToken) {
      return json({ error: 'Google Calendar is not connected for the interviewer. Please reconnect to update the invite.' }, 400);
    }

    // Fetch the event
    const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`;
    const getRes = await fetch(eventUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!getRes.ok) {
      const text = await getRes.text();
      console.error('[update-booking-attendee] Failed to fetch event:', getRes.status, text);
      return json({ error: 'Failed to load calendar event', details: text }, getRes.status);
    }
    const event = await getRes.json();
    const attendees = Array.isArray(event.attendees) ? event.attendees.slice() : [];

    // Replace the candidate attendee (match by old email; otherwise, remove any
    // attendee that isn't marked organizer and looks like the candidate).
    let replaced = false;
    const filtered = attendees.filter((a: any) => {
      if (a?.organizer) return true;
      if (oldEmail && String(a?.email ?? '').toLowerCase() === oldEmail.toLowerCase()) {
        replaced = true;
        return false;
      }
      return true;
    });
    filtered.push({ email: newEmail, responseStatus: 'needsAction' });

    const patchRes = await fetch(`${eventUrl}?sendUpdates=all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendees: filtered }),
    });
    if (!patchRes.ok) {
      const text = await patchRes.text();
      console.error('[update-booking-attendee] PATCH failed:', patchRes.status, text);
      return json({ error: 'Google Calendar rejected the update', details: text }, patchRes.status);
    }

    // Update our row
    const { error: updErr } = await supabase
      .from('scheduled_bookings')
      .update({ candidate_email: newEmail })
      .eq('id', bookingId);
    if (updErr) {
      console.error('[update-booking-attendee] DB update failed:', updErr);
      return json({ error: updErr.message }, 500);
    }

    return json({ success: true, new_email: newEmail, google_updated: true, replaced });
  } catch (err) {
    console.error('[update-booking-attendee] Unhandled error:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeadersFor(req.headers.get('Origin') ?? undefined), 'Content-Type': 'application/json' },
    });
  }
});
