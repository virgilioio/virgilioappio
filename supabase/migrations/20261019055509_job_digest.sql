-- The hiring team's daily digest (job_settings.daily_digest, 2026-10-19).
--
-- At 9:00 Mexico City time the database writes one digest per person: the open
-- jobs they're on (recruiter, hiring manager, reporting manager, coordinator)
-- whose digest is on, with the last day's applications, stage moves and Gio's
-- rejections; jobs with nothing to say are left out, and so is anyone with
-- nothing at all. It rings their bell when they keep daily digests in the app,
-- and the job-daily-digest Edge Function emails the ones who keep them by email
-- (Settings > Notifications, both off unless the person turns them on).
--
-- Also: profiles default to the "UTC" time zone, so a sender who never chose one
-- read as UTC and Gio's 9:00 rejection email went out at 3:00 in Mexico. An unset
-- (UTC) zone now reads as Mexico City.

create or replace function public.next_morning_nine(_email text)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  with tz as (
    select coalesce(
      (select nullif(nullif(p.timezone, ''), 'UTC') from public.user_mail_identities i
         join public.profiles p on p.user_id = i.user_id
        where i.email_address = _email and i.is_active
        limit 1),
      'America/Mexico_City') as z
  )
  select ((((now() at time zone z)::date + 1) + time '09:00') at time zone z) from tz;
$$;
revoke all on function public.next_morning_nine(text) from public, anon, authenticated;

-- One row per person per day: what the digest says, and whether its email went.
create table if not exists public.job_digests (
  user_id uuid not null,
  day date not null,
  content jsonb not null,
  wants_email boolean not null default false,
  emailed_at timestamptz,
  attempts integer not null default 0,
  claimed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.job_digests enable row level security;
-- No policies: only the database and the Edge Function (service role) use it.

-- Write today's digests (once per person per day) and ring the bells.
create or replace function public.job_digest_prepare()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'America/Mexico_City')::date;
  since timestamptz := now() - interval '24 hours';
  rec record;
  made integer := 0;
  apps integer;
  moves integer;
  gio integer;
  head text;
begin
  for rec in
    with jobs_on as (
      select j.id, j.title, j.tenant_id
        from public.jobs j
        join public.job_settings s on s.job_id = j.id and s.daily_digest
       where j.deleted_at is null and j.status = 'open'
    ),
    per_job as (
      select r.user_id, jo.id as job_id, jo.title, jo.tenant_id,
             (select count(*) from public.job_candidate_associations a
               where a.job_id = jo.id and a.applied_at >= since) as apps,
             (select array_agg(n order by t desc) from (
                select coalesce(nullif(btrim(c.candidate_name), ''), 'Unnamed candidate') as n, a.applied_at as t
                  from public.job_candidate_associations a join public.candidates c on c.id = a.candidate_id
                 where a.job_id = jo.id and a.applied_at >= since
                 order by a.applied_at desc limit 3) x) as names,
             (select count(*) from public.stage_events e
               where e.job_id = jo.id and e.occurred_at >= since and e.from_stage is not null) as moves,
             (select count(*) from public.job_candidate_associations a
               where a.job_id = jo.id and a.auto_rejected_rule is not null and a.rejected_at >= since) as gio
        from jobs_on jo
        cross join lateral public.job_team_recipients(jo.id) as r(user_id)
    )
    select p.user_id,
           min(p.tenant_id::text)::uuid as tenant_id,
           jsonb_agg(jsonb_build_object('job_id', p.job_id, 'title', p.title, 'apps', p.apps,
                                        'names', coalesce(to_jsonb(p.names), '[]'::jsonb),
                                        'moves', p.moves, 'gio_rejections', p.gio)
                     order by p.apps desc, p.moves desc, p.title) as jobs,
           sum(p.apps)::int as apps, sum(p.moves)::int as moves, sum(p.gio)::int as gio
      from per_job p
     where p.apps + p.moves + p.gio > 0
       and not exists (select 1 from public.job_digests d where d.user_id = p.user_id and d.day = today)
     group by p.user_id
  loop
    insert into public.notification_preferences (user_id) values (rec.user_id) on conflict (user_id) do nothing;
    insert into public.job_digests (user_id, day, content, wants_email)
    values (rec.user_id, today,
            jsonb_build_object('jobs', rec.jobs, 'apps', rec.apps, 'moves', rec.moves, 'gio_rejections', rec.gio),
            coalesce((select np.daily_digest_email from public.notification_preferences np where np.user_id = rec.user_id), false))
    on conflict (user_id, day) do nothing;
    if found then
      made := made + 1;
      apps := rec.apps; moves := rec.moves; gio := rec.gio;
      head := concat_ws(', ',
        case when apps > 0 then apps || case when apps = 1 then ' application' else ' applications' end end,
        case when moves > 0 then moves || case when moves = 1 then ' stage move' else ' stage moves' end end,
        case when gio > 0 then gio || case when gio = 1 then ' rejected by Gio' else ' rejected by Gio' end end);
      perform public.emit_notification(
        rec.user_id, rec.tenant_id, 'daily_digest'::public.notification_category, null, 'Gio', null,
        'Your jobs since yesterday: ' || head, null, null, 'job', null, null, null, '/jobs',
        jsonb_build_object('day', today, 'kind', 'job_digest'));
    end if;
  end loop;
  return made;
end;
$$;

-- The Edge Function's queue: digests owed by email, claimed for ten minutes.
create or replace function public.job_digest_claim(_limit integer default 50)
returns table (user_id uuid, day date, email text, name text, content jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select d.user_id, d.day
      from public.job_digests d
     where d.wants_email and d.emailed_at is null and d.attempts < 5
       and (d.claimed_at is null or d.claimed_at < now() - interval '10 minutes')
     order by d.created_at
     limit _limit
     for update skip locked
  ),
  claimed as (
    update public.job_digests d
       set claimed_at = now(), attempts = d.attempts + 1
      from due
     where d.user_id = due.user_id and d.day = due.day
    returning d.user_id, d.day, d.content
  )
  select c.user_id, c.day,
         coalesce(nullif(btrim(p.email), ''), u.email)::text,
         coalesce(nullif(btrim(concat(p.first_name, ' ', p.last_name)), ''), '')::text,
         c.content
    from claimed c
    left join public.profiles p on p.user_id = c.user_id
    left join auth.users u on u.id = c.user_id;
end;
$$;

create or replace function public.job_digest_finish(_user_id uuid, _day date, _ok boolean, _error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.job_digests
     set emailed_at = case when _ok then now() end,
         claimed_at = case when _ok then claimed_at end,
         error = case when _ok then null else left(coalesce(_error, 'failed'), 500) end
   where user_id = _user_id and day = _day and emailed_at is null;
$$;

revoke all on function public.job_digest_prepare(), public.job_digest_claim(integer),
  public.job_digest_finish(uuid, date, boolean, text) from public, anon, authenticated;
grant execute on function public.job_digest_claim(integer), public.job_digest_finish(uuid, date, boolean, text)
  to service_role;

-- 9:00 Mexico City (15:00 UTC; Mexico keeps no daylight time), then every 15
-- minutes until 11:45 for any email that failed: write the digests (once a day),
-- and call the sender only when there's mail.
select cron.schedule(
  'job-daily-digest',
  '*/15 15-17 * * *',
  $cmd$
  select public.job_digest_prepare();
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/job-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id
  where exists (select 1 from public.job_digests where wants_email and emailed_at is null and attempts < 5);
  $cmd$
);
