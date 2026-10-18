-- The bell goes live (2026-10-18). New notifications reach the app the moment
-- they're written (Supabase Realtime), so the bell, the count and the sound
-- for mentions and offer approvals don't wait for the minute poll. Realtime
-- applies the table's RLS: each person only ever receives their own rows
-- ("Users select own notifications"). Nothing else changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
