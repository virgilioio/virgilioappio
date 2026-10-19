-- Reference checks (Allan, 2026-10-19): automatic reminders never ran, and a
-- resend to a referee didn't show up until the page was reloaded.
--
-- 1. The reminders job. The template's "Links & reminders" settings were saved
--    on every request, but nothing ever called the reference-reminders
--    function. It now runs once a day at 15:07 UTC (9:07 in Mexico City), and
--    only when some referee or candidate is still waiting.
-- 2. Each email in a request's log names its referee, so a referee's
--    reminders are counted exactly (they were matched by name in the label).
-- 3. Live updates: the reference screens already listen for changes to these
--    three tables, but the tables were never published, so nothing arrived.
--    Row Level Security still decides who receives each change.

alter table public.reference_activity add column if not exists referee_id uuid;
comment on column public.reference_activity.referee_id is
  'The referee an email or event is about (null for request-wide events).';
create index if not exists reference_activity_referee_idx
  on public.reference_activity (referee_id) where referee_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['reference_activity', 'reference_referees', 'reference_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select cron.schedule(
  'reference-reminders',
  '7 15 * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/reference-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id
  where exists (
    select 1
      from public.reference_requests q
     where q.cancelled_at is null
       and coalesce((q.template_snapshot -> 'reminders' ->> 'enabled')::boolean, false)
       and (
         (q.state = 'candidate' and q.consent_recorded_at is null
          and (q.candidate_link_expires_at is null or q.candidate_link_expires_at > now()))
         or exists (
           select 1 from public.reference_referees f
            where f.request_id = q.id
              and f.status in ('invited', 'opened', 'in_progress')
              and not f.on_hold
              and (f.link_expires_at is null or f.link_expires_at > now())
         )
       )
  );
  $cmd$
);
