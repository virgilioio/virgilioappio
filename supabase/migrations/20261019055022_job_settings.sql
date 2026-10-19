-- Job settings (Allan, 2026-10-19): the Create Job wizard's screening rules and
-- hiring-team notifications, saved per job and carried out by the database.
--
--   * jobs.salary_period: the period the job's salary range is in (month / year).
--   * job_settings: one row per job (made with the job), read and edited by the
--     people who can edit the job.
--   * job_candidate_associations.applied_at: set by the application forms, so only
--     real applications are screened and announced.
--   * Screening: an application from outside the job's hiring countries, or asking
--     more than the margin above the job's top salary, is rejected at once; the
--     first Gio Fit score under the job's bar does the same. Gio is the author; the
--     rejection email waits for 9:00 the next morning, and restoring the candidate
--     before then cancels it (for every scheduled rejection, not only Gio's).
--   * Notifications: new applications (batched per job, per person, per hour) and
--     stage moves go to the job's team through emit_notification.

-- 1. The salary range's period -------------------------------------------------
alter table public.jobs add column if not exists salary_period text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_salary_period_check') then
    alter table public.jobs add constraint jobs_salary_period_check
      check (salary_period is null or salary_period in ('monthly', 'annual'));
  end if;
end $$;

-- 2. Applications and Gio's rejections on the association ------------------------
alter table public.job_candidate_associations
  add column if not exists applied_at timestamptz,
  add column if not exists auto_rejected_rule text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jca_auto_rejected_rule_check') then
    alter table public.job_candidate_associations add constraint jca_auto_rejected_rule_check
      check (auto_rejected_rule is null or auto_rejected_rule in ('country', 'salary', 'score'));
  end if;
end $$;

-- Earlier applications: an association whose candidate went through the
-- application limits for that job (the careers page records every application).
update public.job_candidate_associations a
   set applied_at = coalesce(l.applied_at, a.created_at)
  from public.candidate_application_limits l, public.candidates c
 where a.applied_at is null
   and c.id = a.candidate_id
   and l.job_id = a.job_id
   and lower(l.candidate_email) = lower(c.email);

-- 3. Countries ---------------------------------------------------------------------
-- The English country name for a country, a common alias, or a city we hire in.
create or replace function public.country_name(_text text)
returns text
language sql
immutable
set search_path = public
as $$
  with k as (
    select btrim(regexp_replace(
             translate(lower(coalesce(_text, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç.', 'aaaaaeeeeiiiiooooouuuunc'),
             '\s+', ' ', 'g')) as v
  )
  select case
    when v in ('mexico', 'mx', 'mex', 'cdmx', 'ciudad de mexico', 'mexico city', 'mexico df', 'guadalajara',
               'zapopan', 'tlaquepaque', 'san pedro tlaquepaque', 'tonala', 'tlajomulco', 'monterrey',
               'san pedro garza garcia', 'jalisco', 'nuevo leon', 'queretaro', 'puebla', 'tijuana', 'saltillo',
               'merida', 'cancun', 'toluca', 'aguascalientes', 'chihuahua', 'hermosillo', 'culiacan', 'morelia',
               'estado de mexico', 'edomex', 'miguel hidalgo', 'benito juarez', 'cuauhtemoc', 'polanco') then 'Mexico'
    when v in ('united states', 'united states of america', 'usa', 'us', 'estados unidos', 'eeuu', 'eua',
               'new york', 'san francisco', 'austin', 'dallas', 'houston', 'chicago', 'miami', 'los angeles',
               'seattle', 'boston', 'texas', 'california', 'florida', 'illinois') then 'United States'
    when v in ('brazil', 'brasil', 'sao paulo', 'rio de janeiro') then 'Brazil'
    when v in ('argentina', 'buenos aires') then 'Argentina'
    when v in ('chile') then 'Chile'
    when v in ('colombia', 'bogota', 'medellin') then 'Colombia'
    when v in ('peru', 'lima') then 'Peru'
    when v in ('spain', 'espana', 'madrid', 'barcelona') then 'Spain'
    when v in ('canada', 'toronto', 'vancouver', 'montreal') then 'Canada'
    when v in ('united kingdom', 'uk', 'england', 'london', 'reino unido') then 'United Kingdom'
    when v in ('costa rica') then 'Costa Rica'
    when v in ('panama') then 'Panama'
    when v in ('france', 'francia', 'paris') then 'France'
    when v in ('germany', 'alemania', 'berlin') then 'Germany'
    else null
  end
  from k;
$$;

-- The countries named by a list of locations ("Mexico City, Mexico",
-- "Miguel Hidalgo - Ciudad de México"). Regions (LATAM) and "Remote" name none.
create or replace function public.location_countries(_locations text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct c order by c), '{}')
  from (
    select public.country_name(p) as c
    from unnest(coalesce(_locations, '{}')) as whole,
         lateral (select whole
                  union all
                  select regexp_split_to_table(whole, '\s*[,;/|()]\s*|\s+-\s+')) as s(p)
  ) x
  where c is not null;
$$;

-- 4. Settings, one row per job -------------------------------------------------------
create table if not exists public.job_settings (
  job_id uuid primary key,
  -- Screening (every rule only ever touches applications).
  reject_outside_countries boolean not null default false,
  hiring_countries text[] not null default '{}',
  reject_salary_above boolean not null default false,
  salary_margin_pct integer not null default 25 check (salary_margin_pct between 0 and 200),
  auto_score boolean not null default true,
  auto_reject_below boolean not null default false,
  auto_reject_threshold integer not null default 35 check (auto_reject_threshold between 0 and 100),
  ai_summary boolean not null default true,
  -- The email Gio's rejections send; null is the workspace's first rejection template.
  reject_template_id uuid,
  -- The hiring team's notifications.
  notify_applications boolean not null default true,
  notify_stage_moves boolean not null default false,
  daily_digest boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.job_settings enable row level security;

-- Whoever can edit the job (the jobs update policy) reads and edits its settings.
create or replace function public.can_edit_job(_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = _job_id
      and j.deleted_at is null
      and (public.get_user_type_secure() = 'platform_admin'
           or public.check_org_hierarchy_role_access(j.organization_id, 'recruiter')
           or public.is_user_assigned_to_job(j.id))
  );
$$;
revoke all on function public.can_edit_job(uuid) from public, anon;
grant execute on function public.can_edit_job(uuid) to authenticated;

create policy job_settings_select on public.job_settings
  for select to authenticated using (public.can_edit_job(job_id));
create policy job_settings_update on public.job_settings
  for update to authenticated using (public.can_edit_job(job_id)) with check (public.can_edit_job(job_id));
grant select, update on public.job_settings to authenticated;

create or replace function public.job_settings_a_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.job_id := old.job_id;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.hiring_countries := coalesce((select array_agg(distinct btrim(c) order by btrim(c))
                                      from unnest(new.hiring_countries) c where btrim(c) <> ''), '{}');
  return new;
end;
$$;
create or replace trigger job_settings_a_touch before update on public.job_settings
  for each row execute function public.job_settings_a_touch();

-- Every job gets its row, with the countries its locations name.
create or replace function public.jobs_z_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_settings (job_id, hiring_countries)
  values (new.id, public.location_countries(array[new.location] || coalesce(new.additional_locations, '{}')))
  on conflict (job_id) do nothing;
  return new;
end;
$$;
create or replace trigger jobs_z_settings after insert on public.jobs
  for each row execute function public.jobs_z_settings();

insert into public.job_settings (job_id, hiring_countries)
select j.id, public.location_countries(array[j.location] || coalesce(j.additional_locations, '{}'))
  from public.jobs j
on conflict (job_id) do nothing;

-- 5. Gio's rejection reasons (shared library rows) --------------------------------------
insert into public.rejection_reasons (id, tenant_id, name, category, description, is_active, display_order, source, client_label)
values
  ('6a1d0c52-6f0e-4d1b-9a43-0b7f5c1e2a01', null, 'Outside the hiring countries', 'recruiter_rejected',
   'Gio rejects an application from outside the job''s hiring countries.', true, 90, 'platform', 'Location'),
  ('6a1d0c52-6f0e-4d1b-9a43-0b7f5c1e2a02', null, 'Below the job''s Gio Fit bar', 'recruiter_rejected',
   'Gio rejects an application whose first Gio Fit score is under the job''s bar.', true, 91, 'platform', 'Not progressed')
on conflict (id) do nothing;

-- 6. The team ----------------------------------------------------------------------------
-- Recruiters and hiring managers on the job, its reporting manager and coordinator;
-- the job's creator when nobody else is on it.
create or replace function public.job_team_recipients(_job_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with team as (
    select a.user_id from public.job_assignments a
     where a.job_id = _job_id and a.deleted_at is null and a.role in ('recruiter', 'hiring_manager')
    union
    select j.reports_to_user_id from public.jobs j where j.id = _job_id
    union
    select j.coordinator_user_id from public.jobs j where j.id = _job_id
  )
  select distinct user_id from team where user_id is not null
  union
  select j.created_by from public.jobs j
   where j.id = _job_id and j.created_by is not null
     and not exists (select 1 from team where user_id is not null);
$$;
revoke all on function public.job_team_recipients(uuid) from public, anon, authenticated;

-- 7. Gio's rejection ---------------------------------------------------------------------
-- The sender for Gio's rejection emails: the first recruiter on the job, then its
-- creator, then a hiring manager, whose connected mailbox is active and who is an
-- active member.
create or replace function public.job_rejection_sender(_job_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.email_address
    from (
      select a.user_id, 1 as rank_, a.created_at from public.job_assignments a
       where a.job_id = _job_id and a.deleted_at is null and a.role = 'recruiter'
      union all
      select j.created_by, 2, j.created_at from public.jobs j where j.id = _job_id
      union all
      select a.user_id, 3, a.created_at from public.job_assignments a
       where a.job_id = _job_id and a.deleted_at is null and a.role = 'hiring_manager'
    ) who
    join public.user_mail_identities i on i.user_id = who.user_id and i.is_active
   where exists (select 1 from public.members m where m.user_id = who.user_id and m.user_status = 'active')
   order by who.rank_, who.created_at, i.is_default desc, i.created_at
   limit 1;
$$;
revoke all on function public.job_rejection_sender(uuid) from public, anon, authenticated;

-- 9:00 the next morning in the sender's time zone (Mexico City when unknown).
create or replace function public.next_morning_nine(_email text)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  with tz as (
    select coalesce(
      (select nullif(p.timezone, '') from public.user_mail_identities i
         join public.profiles p on p.user_id = i.user_id
        where i.email_address = _email and i.is_active
        limit 1),
      'America/Mexico_City') as z
  )
  select ((((now() at time zone z)::date + 1) + time '09:00') at time zone z) from tz;
$$;
revoke all on function public.next_morning_nine(text) from public, anon, authenticated;

create or replace function public.job_auto_reject(_association_id uuid, _rule text, _detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  j record;
  s record;
  cand record;
  reason uuid;
  tpl record;
  sender text;
  send_at timestamptz;
begin
  select * into a from public.job_candidate_associations where id = _association_id for update;
  if a.id is null or a.status not in ('active', 'new') then
    return;
  end if;
  select id, title, tenant_id, organization_id into j from public.jobs where id = a.job_id;
  select * into s from public.job_settings where job_id = a.job_id;
  select id, candidate_name, coalesce(nullif(btrim(email), ''), nullif(btrim(contact_email), '')) as email
    into cand from public.candidates where id = a.candidate_id;

  reason := case _rule
    when 'country' then '6a1d0c52-6f0e-4d1b-9a43-0b7f5c1e2a01'::uuid
    when 'salary' then '521b3c24-0312-411a-bbe3-72b183fa22a1'::uuid
    else '6a1d0c52-6f0e-4d1b-9a43-0b7f5c1e2a02'::uuid
  end;

  -- The job's template, else the workspace's own first active one, else a shared one.
  select t.id, t.subject, t.body into tpl
    from public.rejection_email_templates t
   where t.is_active
     and (t.tenant_id = j.tenant_id or t.tenant_id is null)
   order by (t.id = s.reject_template_id) desc,
            (t.tenant_id is not null) desc,
            (t.name ilike '%application%') desc,
            t.created_at
   limit 1;

  sender := public.job_rejection_sender(a.job_id);
  if sender is not null and tpl.id is not null and cand.email is not null then
    send_at := public.next_morning_nine(sender);
  end if;

  update public.job_candidate_associations
     set status = 'rejected',
         rejection_reason_id = reason,
         rejection_notes = 'Gio: ' || _detail,
         rejected_at = now(),
         rejected_by = null,
         auto_rejected_rule = _rule,
         rejection_email_scheduled_for = send_at
   where id = a.id;

  if send_at is not null then
    insert into public.scheduled_emails (tenant_id, organization_id, scheduled_for, status, email_type, from_email,
                                         to_emails, subject, body_html, candidate_id, job_id, association_id,
                                         rejection_reason_id, created_by)
    values (j.tenant_id, j.organization_id, send_at, 'pending', 'rejection', sender,
            array[cand.email], tpl.subject, tpl.body, a.candidate_id, a.job_id, a.id, reason, null);
  end if;

  insert into public.activities (activity_type, title, description, entity_type, entity_id, user_id,
                                 organization_id, tenant_id, metadata)
  values ('candidate_status_changed', 'Rejected by Gio', _detail, 'candidate', a.candidate_id,
          '00000000-0000-0000-0000-000000000000', j.organization_id, j.tenant_id,
          jsonb_build_object('job_id', a.job_id, 'job_title', j.title, 'candidate_id', a.candidate_id,
                             'candidate_name', cand.candidate_name, 'old_status', a.status, 'new_status', 'rejected',
                             'rule', _rule, 'email_scheduled_for', send_at, 'source', 'job_screening',
                             'external_actor', 'gio', 'author_name', 'Gio'));
end;
$$;
revoke all on function public.job_auto_reject(uuid, text, text) from public, anon, authenticated;

-- The reason an application breaks the job's screening rules, or null.
create or replace function public.job_screening_verdict(_association_id uuid)
returns table (rule text, detail text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a record;
  j record;
  s record;
  c record;
  cand_country text;
  job_max numeric;
  cand_amt numeric;
  margin numeric;
begin
  select * into a from public.job_candidate_associations where id = _association_id;
  select * into j from public.jobs where id = a.job_id;
  select * into s from public.job_settings where job_id = a.job_id;
  select * into c from public.candidates where id = a.candidate_id;
  if a.id is null or s.job_id is null or c.id is null then
    return;
  end if;

  -- Country: only when the job names its countries and the candidate's is known.
  if s.reject_outside_countries and cardinality(s.hiring_countries) > 0
     and nullif(btrim(c.location_country), '') is not null then
    cand_country := coalesce(public.country_name(c.location_country), btrim(c.location_country));
    if not exists (
      select 1 from unnest(s.hiring_countries) h
       where lower(coalesce(public.country_name(h), btrim(h))) = lower(cand_country)
    ) then
      rule := 'country';
      detail := 'Applied from ' || cand_country || '; the job hires in ' || array_to_string(s.hiring_countries, ', ') || '.';
      return next;
      return;
    end if;
  end if;

  -- Salary: only with the job's top salary and its period, and the candidate's
  -- amount with a monthly or yearly period. Amounts compare per month, in the job's
  -- currency, or both in the workspace's base currency.
  if s.reject_salary_above and j.salary_max is not null and j.salary_period is not null
     and c.salary_amount is not null and c.salary_period in ('monthly', 'annually') then
    job_max := j.salary_max::numeric / case j.salary_period when 'annual' then 12 else 1 end;
    cand_amt := c.salary_amount / case c.salary_period when 'annually' then 12 else 1 end;
    if upper(coalesce(c.salary_currency, j.currency)) <> upper(coalesce(j.currency, 'USD')) then
      select b.base_amount into job_max
        from public.convert_to_base(j.tenant_id, job_max, coalesce(j.currency, 'USD'), current_date) b;
      select b.base_amount into cand_amt
        from public.convert_to_base(j.tenant_id, cand_amt, c.salary_currency, current_date) b;
    end if;
    margin := 1 + s.salary_margin_pct / 100.0;
    if job_max is not null and cand_amt is not null and job_max > 0 and cand_amt > job_max * margin then
      rule := 'salary';
      detail := 'Asked ' || to_char(c.salary_amount, 'FM999,999,999') || ' ' || coalesce(upper(c.salary_currency), '')
                || case c.salary_period when 'annually' then ' a year' else ' a month' end
                || ', more than ' || s.salary_margin_pct || '% above the job''s top of '
                || to_char(j.salary_max, 'FM999,999,999') || ' ' || upper(coalesce(j.currency, 'USD'))
                || case j.salary_period when 'annual' then ' a year' else ' a month' end || '.';
      return next;
      return;
    end if;
  end if;
end;
$$;
revoke all on function public.job_screening_verdict(uuid) from public, anon, authenticated;

-- 8. On a new application: screen it, then tell the team ---------------------------------
create or replace function public.jca_z_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  s record;
  j record;
  cand_name text;
  recip uuid;
  existing uuid;
  n int;
begin
  if new.applied_at is null then
    return new;
  end if;

  begin
    if new.status in ('active', 'new') then
      select * into v from public.job_screening_verdict(new.id);
      if v.rule is not null then
        perform public.job_auto_reject(new.id, v.rule, v.detail);
      end if;
    end if;
  exception when others then
    raise warning 'jca_z_application screening failed: % %', sqlerrm, sqlstate;
  end;

  begin
    select * into s from public.job_settings where job_id = new.job_id;
    if coalesce(s.notify_applications, true) then
      select id, title, tenant_id into j from public.jobs where id = new.job_id;
      select coalesce(nullif(btrim(candidate_name), ''), 'Unnamed candidate') into cand_name
        from public.candidates where id = new.candidate_id;
      for recip in select public.job_team_recipients(new.job_id) loop
        existing := null;
        n := 1;
        -- One notification per person per job per hour; later applications add to it.
        select id, coalesce((metadata->>'count')::int, 1) into existing, n
          from public.notifications
         where user_id = recip and job_id = new.job_id and category = 'application_batch'
           and read_at is null and created_at > now() - interval '1 hour'
         order by created_at desc limit 1;
        if existing is not null then
          update public.notifications
             set title = (n + 1) || ' new applications for ' || coalesce(j.title, 'your job'),
                 preview = cand_name || ' and ' || n || case when n = 1 then ' other' else ' others' end,
                 action_url = '/jobs/' || new.job_id || '/pipeline',
                 entity_kind = 'job', entity_id = new.job_id, candidate_id = null,
                 metadata = metadata || jsonb_build_object('count', n + 1)
           where id = existing;
        else
          perform public.emit_notification(
            recip, j.tenant_id, 'application_batch'::public.notification_category, null, 'Gio', null,
            cand_name || ' applied to ' || coalesce(j.title, 'your job'), coalesce(j.title, ''), null,
            'candidate', new.candidate_id, new.job_id, new.candidate_id,
            '/jobs/' || new.job_id || '/candidates/' || new.candidate_id,
            jsonb_build_object('count', 1, 'association_id', new.id));
        end if;
      end loop;
    end if;
  exception when others then
    raise warning 'jca_z_application notification failed: % %', sqlerrm, sqlstate;
  end;

  return new;
end;
$$;
create or replace trigger jca_z_application after insert on public.job_candidate_associations
  for each row execute function public.jca_z_application();

-- 9. The first Gio Fit score under the bar ----------------------------------------------
create or replace function public.jca_z_score_bar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  stage_type text;
begin
  if new.applied_at is null or new.ai_fit_score is null or old.ai_fit_score is not null
     or new.status not in ('active', 'new') then
    return new;
  end if;
  select * into s from public.job_settings where job_id = new.job_id;
  if not coalesce(s.auto_reject_below, false) or new.ai_fit_score >= s.auto_reject_threshold then
    return new;
  end if;
  -- Only while nobody has moved them on from Application review.
  select st.stage_type into stage_type
    from public.job_hiring_stages h join public.job_stages st on st.id = h.stage_id
   where h.id = new.current_stage_id;
  if new.current_stage_id is not null and stage_type is distinct from 'application_review' then
    return new;
  end if;
  perform public.job_auto_reject(new.id, 'score',
    'Gio Fit ' || new.ai_fit_score || ', under the job''s bar of ' || s.auto_reject_threshold || '.');
  return new;
exception when others then
  raise warning 'jca_z_score_bar failed: % %', sqlerrm, sqlstate;
  return new;
end;
$$;
create or replace trigger jca_z_score_bar after update of ai_fit_score on public.job_candidate_associations
  for each row execute function public.jca_z_score_bar();

-- 10. Restoring a rejected candidate cancels the rejection email still waiting ------------
create or replace function public.jca_a_restore_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(coalesce(old.status, '')) = 'rejected' and lower(coalesce(new.status, '')) <> 'rejected' then
    new.rejection_email_scheduled_for := null;
    new.auto_rejected_rule := null;
  end if;
  return new;
end;
$$;
create or replace trigger jca_a_restore_email before update of status on public.job_candidate_associations
  for each row execute function public.jca_a_restore_email();

create or replace function public.jca_z_restore_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(old.status, '')) = 'rejected' and lower(coalesce(new.status, '')) <> 'rejected' then
    update public.scheduled_emails
       set status = 'cancelled', updated_at = now()
     where association_id = new.id and email_type = 'rejection' and status = 'pending';
  end if;
  return new;
end;
$$;
create or replace trigger jca_z_restore_email after update of status on public.job_candidate_associations
  for each row execute function public.jca_z_restore_email();

-- 11. Stage moves, when the job asks for them --------------------------------------------
create or replace function public.jca_z_stage_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  j record;
  cand_name text;
  stage_name text;
  actor uuid := auth.uid();
  actor_name text;
  actor_avatar text;
  recip uuid;
begin
  if new.current_stage_id is not distinct from old.current_stage_id or new.current_stage_id is null then
    return new;
  end if;
  select * into s from public.job_settings where job_id = new.job_id;
  if not coalesce(s.notify_stage_moves, false) then
    return new;
  end if;
  select id, title, tenant_id into j from public.jobs where id = new.job_id;
  select coalesce(nullif(btrim(candidate_name), ''), 'Unnamed candidate') into cand_name
    from public.candidates where id = new.candidate_id;
  select coalesce(nullif(btrim(h.custom_stage_name), ''), st.stage_name) into stage_name
    from public.job_hiring_stages h join public.job_stages st on st.id = h.stage_id
   where h.id = new.current_stage_id;
  select coalesce(nullif(btrim(concat(p.first_name, ' ', p.last_name)), ''), 'Someone'), p.avatar_url
    into actor_name, actor_avatar
    from public.profiles p where p.user_id = actor;
  for recip in select public.job_team_recipients(new.job_id) loop
    continue when recip = actor;
    perform public.emit_notification(
      recip, j.tenant_id, 'candidate_update'::public.notification_category, actor,
      coalesce(actor_name, 'Gio'), actor_avatar,
      coalesce(actor_name, 'Gio') || ' moved ' || cand_name || ' to ' || coalesce(stage_name, 'a new stage'),
      coalesce(j.title, ''), null, 'candidate', new.candidate_id, new.job_id, new.candidate_id,
      '/jobs/' || new.job_id || '/candidates/' || new.candidate_id,
      jsonb_build_object('association_id', new.id, 'stage_id', new.current_stage_id, 'kind', 'stage_move'));
  end loop;
  return new;
exception when others then
  raise warning 'jca_z_stage_move failed: % %', sqlerrm, sqlstate;
  return new;
end;
$$;
create or replace trigger jca_z_stage_move after update of current_stage_id on public.job_candidate_associations
  for each row execute function public.jca_z_stage_move();
