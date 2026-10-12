-- Find Phase 4 (2026-10-12): market insights in Intelligence.
--
-- 1. classify_job_title(): a standard title, seniority and role family for
--    the GTM titles Virgilio hires for (and the common others), from the
--    title alone. A trigger keeps it on every candidate whose title changes,
--    unless a résumé read gave a better one; a backfill covers the people
--    Collect and the talent pool brought in without one.
-- 2. market_talent_rows(): one slim row per person in the workspace, with
--    the salary as a monthly amount in the workspace's base currency, for
--    the Intelligence widgets.
-- 3. market_past_companies(): where people worked before.

-- ── 1. Title classifier ────────────────────────────────────────────────────
create or replace function public.classify_job_title(p_title text)
returns table (std_title text, seniority text, family text)
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  t text := lower(btrim(coalesce(p_title, '')));
  v_title text;
  v_family text;
  v_sen text;
  v_ic_manager boolean := false;
begin
  if t = '' then
    return;
  end if;
  t := translate(t, 'áéíóúñü', 'aeiounu');

  -- Seniority words first: they shape some titles.
  if t ~ '\m(chief|ceo|cfo|coo|cto|cro|cmo|cpo|founder|co-?founder|owner|director general|managing director)\M'
     or (t ~ '\mpresident\M' and t !~ 'vice') then
    v_sen := 'c_level';
  elsif t ~ '\m(vp|svp|evp|vice ?president|vicepresidente)\M' then
    v_sen := 'vp';
  elsif t ~ '\m(director|directora|head)\M' then
    v_sen := 'director';
  elsif t ~ '\m(intern|internship|becario|becaria|practicante|trainee)\M' then
    v_sen := 'entry';
  elsif t ~ '\m(junior|jr)\M' or t ~ '\m(assistant|asistente|auxiliar)\M' then
    v_sen := 'junior';
  elsif t ~ '\m(senior|sr)\M' then
    v_sen := 'senior';
  elsif t ~ '\m(lead|principal|staff|supervisor|supervisora|coordinador|coordinadora|coordinator|jefe|jefa)\M' then
    v_sen := 'lead';
  end if;

  -- Titles, most specific first.
  if t ~ '\m(sdr|bdr|sales development|business development rep|prospecci|lead generation|outbound rep)' then
    v_title := 'Sales Development Representative'; v_family := 'Sales';
  elsif t ~ '(sales engineer|solutions? (engineer|consultant|architect)|pre-?sales|preventa)' then
    v_title := 'Sales Engineer'; v_family := 'Sales';
  elsif t ~ '(revenue operations|revops|sales operations|sales ops|operaciones comerciales)' then
    v_title := 'Revenue Operations'; v_family := 'Operations';
  elsif t ~ '(customer success|\mcsm\M|exito del cliente|client success)' then
    v_title := 'Customer Success Manager'; v_family := 'Customer Success'; v_ic_manager := true;
  elsif t ~ '(partnerships?|alliances?|alianzas|channel (manager|sales|partner))' then
    v_title := 'Partnerships Manager'; v_family := 'Sales'; v_ic_manager := true;
  elsif t ~ '(chief revenue|\mcro\M)' then
    v_title := 'Chief Revenue Officer'; v_family := 'Sales';
  elsif v_sen = 'c_level' and t ~ '(founder|\mceo\M|chief executive|director general|owner)' then
    v_title := 'Founder / CEO'; v_family := 'Leadership';
  elsif t ~ '(sales|ventas|comercial|revenue|commercial)' and v_sen in ('vp', 'c_level') then
    v_title := 'VP of Sales'; v_family := 'Sales';
  elsif t ~ '(sales|ventas|comercial|revenue|commercial)' and t ~ '\mhead\M' then
    v_title := 'Head of Sales'; v_family := 'Sales';
  elsif t ~ '(sales|ventas|comercial|commercial)' and v_sen = 'director' then
    v_title := 'Sales Director'; v_family := 'Sales';
  elsif t ~ '(sales manager|gerente (de )?(ventas|comercial)|commercial manager|regional sales manager|country manager)' then
    v_title := 'Sales Manager'; v_family := 'Sales';
  elsif t ~ '(account executive|\mae\M|ejecutiv[oa] de (cuenta|ventas)|ejecutiv[oa] comercial|sales executive|sales representative|representante de ventas|vendedor|vendedora|closer)' then
    v_title := 'Account Executive'; v_family := 'Sales';
  elsif t ~ '(account manager|key account|gerente de cuenta|\mkam\M|ejecutiv[oa] de atencion a clientes)' then
    v_title := 'Account Manager'; v_family := 'Sales'; v_ic_manager := true;
  elsif t ~ '(business development|desarrollo de negocio)' then
    v_title := 'Business Development Manager'; v_family := 'Sales'; v_ic_manager := true;
  elsif t ~ '(recruit|talent acquisition|reclut|sourcer|headhunter|atraccion de talento)' then
    v_title := case when v_sen in ('director', 'vp', 'c_level') or t ~ '(manager|gerente|lead)' then 'Talent Acquisition Manager' else 'Recruiter' end;
    v_family := 'HR';
  elsif t ~ '(human resources|recursos humanos|\mhr\M|\mrh\M|people (partner|operations|ops)|hrbp)' then
    v_title := case when v_sen in ('director', 'vp', 'c_level', 'lead') or t ~ '(manager|gerente)' then 'HR Manager' else 'HR Generalist' end;
    v_family := 'HR';
  elsif t ~ '(product manager|product owner|gerente de producto|product lead)' then
    v_title := 'Product Manager'; v_family := 'Product'; v_ic_manager := true;
  elsif t ~ '(marketing|mercadotecnia|growth|demand gen|brand|content|seo|community manager)' then
    v_title := case when v_sen in ('director', 'vp', 'c_level', 'lead') or t ~ '(manager|gerente)' then 'Marketing Manager' else 'Marketing Specialist' end;
    v_family := 'Marketing';
  elsif t ~ '(software|developer|desarrollador|programador|engineer|ingeniero de software|devops|full ?stack|back ?end|front ?end)' then
    v_title := 'Software Engineer'; v_family := 'Engineering';
  elsif t ~ '(financ|accountant|contador|contadora|contable|fp&a|controller|tesorer)' then
    v_title := case when v_sen in ('director', 'vp', 'c_level', 'lead') or t ~ '(manager|gerente)' then 'Finance Manager' else 'Finance Analyst' end;
    v_family := 'Finance';
  elsif t ~ '(operations|operaciones|logistic|logistica|supply chain)' then
    v_title := case when v_sen in ('director', 'vp', 'c_level', 'lead') or t ~ '(manager|gerente)' then 'Operations Manager' else 'Operations Specialist' end;
    v_family := 'Operations';
  end if;

  -- "Manager" makes someone a people lead, except where it's the job name.
  if v_sen is null and t ~ '\m(manager|gerente)\M' and not v_ic_manager then
    v_sen := 'lead';
  end if;
  if v_sen is null and v_title is not null then
    v_sen := 'mid';
  end if;

  if v_title is null and v_sen is null then
    return;
  end if;
  std_title := v_title;
  seniority := v_sen;
  family := v_family;
  return next;
end
$$;

-- Keeps the classified fields on every candidate whose title changes. A
-- résumé read (or a person) that sets standardized_title wins; values this
-- trigger wrote are marked {"src": "rules"} in field_provenance so a later
-- title change can replace them. Runs after the provenance trigger.
create or replace function public.candidates_classify_title()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_title text := coalesce(nullif(btrim(new.current_job_title), ''), nullif(btrim(new.role_current), ''));
  v_prov jsonb := coalesce(new.field_provenance, '{}'::jsonb);
  v_rules jsonb := jsonb_build_object('src', 'rules', 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  r record;
  v_std_by_rules boolean;
begin
  if tg_op = 'UPDATE' then
    -- A value someone else wrote (a résumé read, a person) is theirs from
    -- now on: it loses the "rules" mark, so a later title change keeps it.
    if new.standardized_title is distinct from old.standardized_title then
      v_prov := v_prov - 'standardized_title';
    end if;
    if new.seniority_level is distinct from old.seniority_level then
      v_prov := v_prov - 'seniority_level';
    end if;
    if new.functional_area is distinct from old.functional_area then
      v_prov := v_prov - 'functional_area';
    end if;
    new.field_provenance := v_prov;
    if new.current_job_title is not distinct from old.current_job_title
       and new.role_current is not distinct from old.role_current then
      return new;
    end if;
  end if;
  if v_title is null then
    return new;
  end if;

  v_std_by_rules := v_prov -> 'standardized_title' ->> 'src' = 'rules';
  select * into r from public.classify_job_title(v_title);
  if not found then
    return new;
  end if;

  if r.std_title is not null and (new.standardized_title is null or v_std_by_rules) then
    new.standardized_title := r.std_title;
    v_prov := v_prov || jsonb_build_object('standardized_title', v_rules);
  end if;
  if r.seniority is not null
     and (new.seniority_level is null or v_prov -> 'seniority_level' ->> 'src' = 'rules') then
    new.seniority_level := r.seniority;
    v_prov := v_prov || jsonb_build_object('seniority_level', v_rules);
  end if;
  if r.family is not null
     and (new.functional_area is null or v_prov -> 'functional_area' ->> 'src' = 'rules') then
    new.functional_area := r.family;
    v_prov := v_prov || jsonb_build_object('functional_area', v_rules);
  end if;
  new.field_provenance := v_prov;
  return new;
end
$$;

create trigger zzz_candidates_classify_title
  before insert or update on public.candidates
  for each row execute function public.candidates_classify_title();

-- Backfill: everyone with a title and no standard title yet (mostly people
-- Collect and the talent pool brought in from Apollo).
alter table public.candidates disable trigger update_candidates_updated_at;
alter table public.candidates disable trigger trg_log_candidate_updated;
alter table public.candidates disable trigger candidates_identities_sync;
alter table public.candidates disable trigger trg_normalize_candidate_location;
alter table public.candidates disable trigger trg_validate_candidate_name;
alter table public.candidates disable trigger zz_candidates_provenance;
alter table public.candidates disable trigger zzz_candidates_classify_title;

with classified as (
  select c.id, r.std_title, r.seniority, r.family
  from public.candidates c
  cross join lateral public.classify_job_title(coalesce(nullif(btrim(c.current_job_title), ''), nullif(btrim(c.role_current), ''))) r
  where c.deleted_at is null
    and c.merged_into is null
    and (c.standardized_title is null or c.seniority_level is null or c.functional_area is null)
)
update public.candidates c
   set standardized_title = coalesce(c.standardized_title, k.std_title),
       seniority_level = coalesce(c.seniority_level, k.seniority),
       functional_area = coalesce(c.functional_area, k.family),
       field_provenance = c.field_provenance
         || case when c.standardized_title is null and k.std_title is not null
                 then jsonb_build_object('standardized_title', jsonb_build_object('src', 'rules', 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) else '{}'::jsonb end
         || case when c.seniority_level is null and k.seniority is not null
                 then jsonb_build_object('seniority_level', jsonb_build_object('src', 'rules', 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) else '{}'::jsonb end
         || case when c.functional_area is null and k.family is not null
                 then jsonb_build_object('functional_area', jsonb_build_object('src', 'rules', 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) else '{}'::jsonb end
  from classified k
 where k.id = c.id
   and ((c.standardized_title is null and k.std_title is not null)
     or (c.seniority_level is null and k.seniority is not null)
     or (c.functional_area is null and k.family is not null));

alter table public.candidates enable trigger update_candidates_updated_at;
alter table public.candidates enable trigger trg_log_candidate_updated;
alter table public.candidates enable trigger candidates_identities_sync;
alter table public.candidates enable trigger trg_normalize_candidate_location;
alter table public.candidates enable trigger trg_validate_candidate_name;
alter table public.candidates enable trigger zz_candidates_provenance;
alter table public.candidates enable trigger zzz_candidates_classify_title;

-- ── 2. Market rows ─────────────────────────────────────────────────────────
-- A salary as a monthly amount, before currency conversion.
create or replace function public.salary_per_month(p_amount numeric, p_period text, p_currency text)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_amount is null or p_amount <= 0 then null
    else p_amount * case lower(coalesce(p_period, ''))
      when 'monthly' then 1
      when 'month' then 1
      when 'annually' then 1.0 / 12
      when 'annual' then 1.0 / 12
      when 'yearly' then 1.0 / 12
      when 'year' then 1.0 / 12
      when 'hourly' then 173.33
      when 'hour' then 173.33
      when 'weekly' then 4.333
      when 'week' then 4.333
      when 'biweekly' then 2.1667
      when 'daily' then 21.67
      when 'day' then 21.67
      -- No period: LATAM currencies are quoted monthly, the rest yearly.
      else case when upper(coalesce(p_currency, '')) in ('MXN', 'COP', 'CLP', 'ARS', 'BRL', 'PEN', 'UYU') then 1 else 1.0 / 12 end
    end
  end
$$;

-- One row per person in the workspace, for the Intelligence widgets. The
-- salary is per month in the workspace's base currency (today's rate), or
-- null when there's none or it can't be converted. Members only.
create or replace function public.market_talent_rows(p_tenant uuid)
returns table (
  id uuid,
  country text,
  state text,
  city text,
  title text,
  role_family text,
  specialization text,
  seniority text,
  company text,
  years_experience integer,
  skills text[],
  source text,
  created_at timestamptz,
  salary_month_base numeric,
  base_currency text,
  in_pipeline boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text;
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  v_base := coalesce(public.get_tenant_base_currency(p_tenant), 'USD');

  return query
  select
    c.id,
    case when lower(coalesce(c.location_country, '')) in ('', 'no especificado', 'not specified', 'unknown', 'n/a')
         then null else c.location_country end,
    nullif(btrim(c.location_state), ''),
    nullif(btrim(c.location_city), ''),
    coalesce(nullif(btrim(c.standardized_title), ''), nullif(btrim(c.current_job_title), ''), nullif(btrim(c.role_current), '')),
    nullif(btrim(c.functional_area), ''),
    nullif(btrim(c.specialization), ''),
    nullif(btrim(c.seniority_level), ''),
    nullif(btrim(c.company_current), ''),
    c.years_experience,
    coalesce(c.standardized_skills, c.skills),
    nullif(btrim(c.source), ''),
    c.created_at,
    case when public.salary_per_month(c.salary_amount, c.salary_period, c.salary_currency) is null then null
         when upper(coalesce(c.salary_currency, v_base)) = v_base
           then round(public.salary_per_month(c.salary_amount, c.salary_period, c.salary_currency), 2)
         else (select round(b.base_amount, 2)
               from public.convert_to_base(p_tenant, public.salary_per_month(c.salary_amount, c.salary_period, c.salary_currency),
                                           upper(c.salary_currency), current_date) b)
    end,
    v_base,
    exists (
      select 1 from public.job_candidate_associations jca
      where jca.candidate_id = c.id and jca.status in ('active', 'offer'))
  from public.candidates c
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and c.merged_into is null
  order by c.created_at, c.id;
end
$$;

revoke all on function public.market_talent_rows(uuid) from public, anon;
grant execute on function public.market_talent_rows(uuid) to authenticated, service_role;

-- Where people worked before (not their current job), one row per person
-- and company.
create or replace function public.market_past_companies(p_tenant uuid)
returns table (candidate_id uuid, company text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  return query
  select distinct w.candidate_id, btrim(w.company_name)
  from public.candidate_work_experience w
  join public.candidates c on c.id = w.candidate_id
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and c.merged_into is null
    and not coalesce(w.is_current, false)
    and nullif(btrim(w.company_name), '') is not null
    and lower(btrim(w.company_name)) not in ('unknown company', 'unknown', 'n/a', 'confidential', 'confidencial')
  order by 1, 2;
end
$$;

revoke all on function public.market_past_companies(uuid) from public, anon;
grant execute on function public.market_past_companies(uuid) to authenticated, service_role;
