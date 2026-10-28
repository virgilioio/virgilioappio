-- Slack: the events an automation may use come from one function (Allan,
-- 2026-10-28). Applied from a desktop chat: it swaps a check constraint.
--
-- The first Slack migration listed the events inside the table's check, so
-- adding one meant replacing the check. From here the check asks
-- slack_event_known(), and a new event is a `create or replace` of that
-- function in an ordinary migration.
--
-- Adds the People events: member.joined (someone joins Gio ATS) and
-- member.profile_incomplete (their profile still has gaps).

create or replace function public.slack_event_known(_event text)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select _event in (
    'candidate.applied', 'candidate.stage_changed', 'candidate.hired', 'candidate.rejected',
    'interview.scheduled', 'interview.cancelled', 'scorecard.submitted',
    'offer.approval_requested', 'offer.approved', 'offer.sent', 'offer.signed', 'offer.declined',
    'job.opened', 'job.closed',
    'member.joined', 'member.profile_incomplete');
$function$;

alter table public.slack_automations drop constraint slack_automations_event_check;
alter table public.slack_automations add constraint slack_automations_event_check
  check (public.slack_event_known(event));
