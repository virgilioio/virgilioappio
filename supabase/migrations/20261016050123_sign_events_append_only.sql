-- Gio Sign: make the audit trail append-only, even for Edge Functions
-- (build step 1, Allan approved Sign 2026-10-16). RLS already stops every
-- user; this closes the gap for the service role. Applied from a desktop chat
-- because the cloud connector won't run these statements. Rename the file to
-- the version it is applied with.

create or replace function public.sign_events_append_only()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  raise exception 'The Sign audit trail can''t be changed.' using errcode = 'GSN09';
end;
$function$;

create trigger sign_events_no_change
  before update or delete on public.sign_events
  for each row execute function public.sign_events_append_only();

create trigger sign_events_no_truncate
  before truncate on public.sign_events
  for each statement execute function public.sign_events_append_only();
