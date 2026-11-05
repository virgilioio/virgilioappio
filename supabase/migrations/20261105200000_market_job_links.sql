-- Intelligence by job and client (Allan, 2026-11-05).
--
-- Intelligence reads the whole talent database (market_talent_rows, one row per person).
-- This adds where each person stands in the jobs the caller can see, so the page can be
-- filtered and split by client, job, stage, status in the job, how they came in, when they
-- were added and why they were rejected:
--   market_job_links(tenant): one row per person per job, only for jobs the caller may
--   open (can_access_job_pipeline: platform admins, the job's team, and people with
--   recruiter access to its client). Read only; same tenant check as its siblings.
--   Each row also carries the job's pay range per month in the workspace's base currency
--   (its budget when one is set, else its salary range; converted like candidate salaries
--   in market_talent_rows), so salary widgets can say how people compare with it.

create or replace function public.market_job_links(p_tenant uuid)
returns table (
  candidate_id uuid,
  job_id uuid,
  job_title text,
  job_status text,
  client_id uuid,
  client_name text,
  status text,
  stage_name text,
  stage_type text,
  applied boolean,
  added_at timestamptz,
  rejection_reason text,
  budget_min_month_base numeric,
  budget_max_month_base numeric
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_base text;
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;

  v_base := coalesce(public.get_tenant_base_currency(p_tenant), 'USD');

  return query
  with visible as materialized (
    select j.id, j.title, j.status::text as status, j.organization_id,
      b.lo, b.hi, b.period, upper(coalesce(b.currency, v_base)) as currency
    from public.jobs j
    cross join lateral (
      select
        case when j.budget_salary_min is not null or j.budget_salary_max is not null then j.budget_salary_min else j.salary_min::numeric end as lo,
        case when j.budget_salary_min is not null or j.budget_salary_max is not null then j.budget_salary_max else j.salary_max::numeric end as hi,
        case when j.budget_salary_min is not null or j.budget_salary_max is not null then j.budget_period::text else j.salary_period::text end as period,
        case when j.budget_salary_min is not null or j.budget_salary_max is not null then j.budget_currency::text else j.currency::text end as currency
    ) b
    where j.tenant_id = p_tenant
      and j.deleted_at is null
      and (auth.uid() is null or public.can_access_job_pipeline(j.id))
  ),
  banded as materialized (
    select v.*,
      (select case when m is null then null when v.currency = v_base then round(m, 2)
                   else (select round(x.base_amount, 2) from public.convert_to_base(p_tenant, m, v.currency, current_date) x) end
       from (select public.salary_per_month(v.lo, v.period, v.currency) as m) q) as lo_base,
      (select case when m is null then null when v.currency = v_base then round(m, 2)
                   else (select round(x.base_amount, 2) from public.convert_to_base(p_tenant, m, v.currency, current_date) x) end
       from (select public.salary_per_month(v.hi, v.period, v.currency) as m) q) as hi_base
    from visible v
  )
  select
    a.candidate_id,
    v.id,
    coalesce(nullif(btrim(v.title), ''), 'Untitled job'),
    v.status,
    v.organization_id,
    nullif(btrim(o.name), ''),
    a.status,
    coalesce(nullif(btrim(h.custom_stage_name), ''), st.stage_name),
    st.stage_type::text,
    a.applied_at is not null,
    a.created_at,
    case when a.status = 'rejected' then coalesce(nullif(btrim(rr.name), ''), case when a.auto_rejected_rule is not null then 'Screened out by Gio' end) end,
    v.lo_base,
    v.hi_base
  from public.job_candidate_associations a
  join banded v on v.id = a.job_id
  join public.candidates c on c.id = a.candidate_id
  left join public.organizations o on o.id = v.organization_id
  left join public.job_hiring_stages h on h.id = a.current_stage_id
  left join public.job_stages st on st.id = h.stage_id
  left join public.rejection_reasons rr on rr.id = a.rejection_reason_id
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and c.merged_into is null
  order by a.candidate_id, a.created_at, a.id;
end
$$;

revoke all on function public.market_job_links(uuid) from public, anon;
grant execute on function public.market_job_links(uuid) to authenticated;

comment on function public.market_job_links(uuid) is
  'Intelligence: one row per person per job the caller can open (can_access_job_pipeline), with client, status in the job, stage, applied or added, added date, rejection reason and the job''s pay range per month in the base currency.';
