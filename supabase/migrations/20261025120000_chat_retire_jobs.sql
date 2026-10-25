-- Chat is retired (Allan, 2026-10-25): the Inbox replaced it. Step 1 of 2.
-- Nothing reads or writes Chat any more: its screens, its candidate page and
-- its Edge Functions are gone, and applications no longer open a thread. This
-- stops Chat's scheduled jobs and takes Chat out of the retention check.
-- Chat's tables, functions and columns go in step 2 (a desktop migration),
-- which also takes Chat out of platform_remove_workspace. The rate limiter
-- (chat_rate_limits, chat_bump_rate_limit) stays: the public reference-check
-- pages use it.

-- 1. Chat's scheduled jobs --------------------------------------------------
do $$
declare
  j text;
begin
  foreach j in array array['chat-notification-processor', 'chat-retention-sweeper', 'chat-messages-create-partitions'] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end $$;

-- 2. Retention: a candidate's last contact no longer reads Chat ------------
create or replace function public.candidates_due_for_retention(p_tenant uuid, p_limit integer)
returns table(candidate_id uuid, email text, first_name text, last_contact timestamp with time zone)
language sql
stable security definer
set search_path to ''
as $function$
  with last as (
    select c.id, c.candidate_name, coalesce(nullif(c.email, ''), c.contact_email) as email,
           greatest(
             c.created_at,
             (select max(coalesce(e.sent_at, e.received_at, e.created_at)) from public.email_logs e where e.candidate_id = c.id),
             (select max(a.updated_at) from public.job_candidate_associations a where a.candidate_id = c.id)
           ) as last_contact
    from public.candidates c
    where c.tenant_id = p_tenant
      and c.deleted_at is null
      and c.retention_checked_at is null
      and (c.keep_until is null or c.keep_until < now())
      and c.created_at < now() - interval '3 years'
  )
  select id, lower(btrim(email)), nullif(split_part(btrim(coalesce(candidate_name, '')), ' ', 1), ''), last_contact
  from last
  where last_contact < now() - interval '3 years'
    and email is not null and email like '%@%'
  order by last_contact
  limit greatest(0, least(p_limit, 1000));
$function$;
