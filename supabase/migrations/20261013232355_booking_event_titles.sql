-- Meetings booked through general booking links carry their own title (2026-10-13).
-- A booking made from a general link (no job, no recruiter) is a meeting, not an
-- interview. Its title comes from the event type the person picked: the event
-- type's custom title when one was set on purpose, otherwise
-- "{event type name} · {booker's name}". The title is stored on the booking so
-- reschedule, cancel and calendar-repair emails and the app's lists can show it.
--
-- event_type_id has no foreign key on purpose: event types can be removed from
-- Settings, and a key without a cascade rule would block that. It is only a
-- record of which event type was booked.
--
-- The event type form used to pre-fill "Interview with {candidate_name}", so most
-- event types and booking links carry it without anyone choosing it. Those are
-- cleared so the event type's own name is used, except Malena's "Entrevista",
-- where it reads as intended (Allan, 2026-10-13).

alter table public.scheduled_bookings
  add column event_title text,
  add column event_type_id uuid;

update public.booking_event_types
set custom_event_title = null,
    updated_at = now()
where custom_event_title = 'Interview with {candidate_name}'
  and id <> 'db43b670-eba9-422e-98de-3b7210da0ce7';

update public.booking_configurations
set custom_event_title = null,
    updated_at = now()
where custom_event_title = 'Interview with {candidate_name}';
