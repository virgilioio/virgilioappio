-- Voluntary self-identification is reported in totals only (Allan, 2026-11-04).
--
-- Applicants' answers (candidate_eeo_responses, written only by the
-- public-submit-application Edge Function) are kept apart from the application
-- and away from anyone deciding about a candidate. Admins see totals, never a
-- named person's answers:
--   1. eeo_report(tenant, from, to, job): counts per question and answer for
--      applications made through a careers form, and how far each group got
--      (past application review, offer, hired). Any count of 1 to 4 comes back
--      as null ("fewer than 5") so a small job can't point to someone.
--      Admins, workspace owners and platform admins only (can_view_eeo; GEE01).
--   2. Nobody reads the table directly any more: the admin read rule now lets
--      no rows through. Saving from the careers form (service role) and the
--      removal of answers with their candidate (the foreign key cascades) don't change.

create or replace function public.eeo_report(
  p_tenant uuid,
  p_from date default null,
  p_to date default null,
  p_job uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := case when p_from is null then null else (p_from::timestamp at time zone 'America/Mexico_City') end;
  v_to timestamptz := case when p_to is null then null else ((p_to + 1)::timestamp at time zone 'America/Mexico_City') end;
  v_out jsonb;
begin
  if auth.uid() is null or p_tenant is null or not public.can_view_eeo(auth.uid(), p_tenant) then
    raise exception 'Only admins can open the self-identification report.' using errcode = 'GEE01';
  end if;

  with apps as (
    -- Applications made through a careers form in the period (one row per application).
    select
      a.candidate_id,
      a.status::text as status,
      coalesce(st.stage_type::text, '') as stage_type
    from public.job_candidate_associations a
    join public.jobs j on j.id = a.job_id and j.tenant_id = p_tenant and j.deleted_at is null
    left join public.job_hiring_stages h on h.id = a.current_stage_id
    left join public.job_stages st on st.id = h.stage_id
    where a.applied_at is not null
      and (p_job is null or a.job_id = p_job)
      and (v_from is null or a.applied_at >= v_from)
      and (v_to is null or a.applied_at < v_to)
  ),
  rows_ as (
    select
      ap.*,
      e.id is not null as has_answers,
      coalesce(e.gender::text, 'not_answered') as gender,
      coalesce(e.race_ethnicity::text, 'not_answered') as race_ethnicity,
      coalesce(e.veteran_status::text, 'not_answered') as veteran_status,
      coalesce(e.disability_status::text, 'not_answered') as disability_status,
      (ap.status in ('offer', 'hired') or ap.stage_type not in ('', 'application_review')) as past_review,
      (ap.status in ('offer', 'hired') or ap.stage_type in ('offer', 'hired')) as reached_offer,
      (ap.status = 'hired') as hired
    from apps ap
    left join public.candidate_eeo_responses e on e.candidate_id = ap.candidate_id and e.tenant_id = p_tenant
  ),
  per_answer as (
    select q.question, q.answer,
      count(*) as applicants,
      count(*) filter (where r.past_review) as past_review,
      count(*) filter (where r.reached_offer) as offer,
      count(*) filter (where r.hired) as hired
    from rows_ r
    cross join lateral (values
      ('gender', r.gender),
      ('race_ethnicity', r.race_ethnicity),
      ('veteran_status', r.veteran_status),
      ('disability_status', r.disability_status)
    ) as q(question, answer)
    group by q.question, q.answer
  )
  select jsonb_build_object(
    'applicants', (select count(*) from rows_),
    'answered_any', (select count(*) from rows_ r where r.has_answers
      and not (r.gender in ('decline', 'not_answered') and r.race_ethnicity in ('decline', 'not_answered')
               and r.veteran_status in ('decline', 'not_answered') and r.disability_status in ('decline', 'not_answered'))),
    'declined_all', (select count(*) from rows_ r where r.has_answers
      and r.gender in ('decline', 'not_answered') and r.race_ethnicity in ('decline', 'not_answered')
      and r.veteran_status in ('decline', 'not_answered') and r.disability_status in ('decline', 'not_answered')),
    'not_answered', (select count(*) from rows_ r where not r.has_answers),
    'min_group', 5,
    'questions', coalesce((
      select jsonb_object_agg(question, answers)
      from (
        select question, jsonb_agg(jsonb_build_object(
          'answer', answer,
          'applicants', case when applicants between 1 and 4 then null else applicants end,
          'past_review', case when past_review between 1 and 4 then null else past_review end,
          'offer', case when offer between 1 and 4 then null else offer end,
          'hired', case when hired between 1 and 4 then null else hired end
        ) order by answer) as answers
        from per_answer
        group by question
      ) g
    ), '{}'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.eeo_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.eeo_report(uuid, date, date, uuid) to authenticated;

comment on function public.eeo_report(uuid, date, date, uuid) is
  'Self-identification totals for admins (can_view_eeo): per question and answer, with pipeline progress; counts of 1-4 come back null. Never names. GEE01 for anyone else.';

-- No direct reads: the report is the only way in.
alter policy eeo_admins_select on public.candidate_eeo_responses using (false);
