-- The hired salary (Allan, Go! 2026-11-25). The offer is where a recruiter last
-- records a candidate's salary, so the offer is the record of what someone was
-- hired at:
--   * an offer's Salary value carries its own pay period (monthly · annually),
--     chosen on the offer, not fixed by the form,
--   * one Salary field per form is the base salary (the hired salary),
--   * marking someone hired needs an offer with a base salary, and that salary
--     is kept on the opening (job_openings.hired_salary_*), following the offer
--     when it's corrected later or written after the hire,
--   * Gio Sales gets the yearly figure for the success fee, and hears a change.
-- Reports read the hire's salary through market_hires().

-- 1. A pay period from an amount's size, for values saved before offers had one:
-- under about USD 15,000 is monthly, anything else yearly (the rule Gio Fit uses
-- for a job's range, bandPeriodOf).
create or replace function public.salary_period_guess(p_amount numeric, p_currency text, p_tenant uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  with r as (
    select coalesce(
      case when upper(coalesce(p_currency, 'USD')) = 'USD' then 1 end,
      (select c.rate from public.currency_rates c
        where c.base_currency = upper(p_currency) and c.quote_currency = 'USD'
          and (c.tenant_id = p_tenant or c.tenant_id is null)
        order by c.rate_date desc limit 1),
      (select 1 / c.rate from public.currency_rates c
        where c.base_currency = 'USD' and c.quote_currency = upper(p_currency) and c.rate > 0
          and (c.tenant_id = p_tenant or c.tenant_id is null)
        order by c.rate_date desc limit 1),
      case upper(p_currency)
        when 'EUR' then 1.08 when 'GBP' then 1.27 when 'CAD' then 0.73 when 'AUD' then 0.66
        when 'CHF' then 1.13 when 'MXN' then 0.055 when 'COP' then 0.00025 when 'BRL' then 0.18
        when 'CLP' then 0.0011 when 'PEN' then 0.27 when 'ARS' then 0.001 when 'INR' then 0.012
        when 'PHP' then 0.017 end
    ) usd_per_unit
  )
  select case
    when p_amount is null or p_amount <= 0 then null
    when r.usd_per_unit is null then 'annually'
    when p_amount * r.usd_per_unit < 15000 then 'monthly'
    else 'annually'
  end
  from r
$function$;

revoke all on function public.salary_period_guess(numeric, text, uuid) from public, anon, authenticated;

-- 2. One stored Salary value, read: { amount, currency, period } (period only
-- when the value has one of ours).
create or replace function public.offer_salary_value(p_raw text)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  j jsonb;
  amt numeric;
  per text;
begin
  if p_raw is null or btrim(p_raw) = '' then return null; end if;
  begin j := p_raw::jsonb; exception when others then j := null; end;
  if jsonb_typeof(j) = 'object' then
    begin
      amt := nullif(regexp_replace(coalesce(j->>'amount', ''), '[^0-9.]', '', 'g'), '')::numeric;
    exception when others then amt := null; end;
    per := lower(btrim(coalesce(j->>'period', '')));
    per := case when per in ('monthly', 'month') then 'monthly'
                when per in ('annually', 'annual', 'yearly', 'year') then 'annually'
                when per in ('hourly', 'hour') then 'hourly' end;
    return jsonb_strip_nulls(jsonb_build_object('amount', amt, 'currency', nullif(upper(btrim(coalesce(j->>'currency', ''))), ''), 'period', per));
  end if;
  begin
    amt := nullif(regexp_replace(p_raw, '[^0-9.]', '', 'g'), '')::numeric;
  exception when others then amt := null; end;
  return jsonb_strip_nulls(jsonb_build_object('amount', amt));
end
$function$;

-- 3. Which field of a form is the base salary: the Salary field marked as it
-- (field_config.base), else the one named base_salary, else the form's first
-- Salary field.
create or replace function public.offer_form_base_field(p_form uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select f.field_name
    from public.offer_form_fields f
   where f.form_id = p_form and f.field_type::text = 'salary'
   order by (coalesce(f.field_config->>'base', '') = 'true') desc,
            (f.field_name = 'base_salary') desc,
            f.display_order, f.created_at
   limit 1
$function$;

revoke all on function public.offer_form_base_field(uuid) from public, anon;

-- 4. An offer's base salary: { amount, currency, period }, or null when it has
-- none. A value with no period of its own (written before this) is read by size.
create or replace function public.offer_letter_base_salary(p_offer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  o record;
  field text;
  v jsonb;
  cfg jsonb;
  tenant uuid;
begin
  select l.id, l.form_id, l.field_values, l.job_id into o from public.offer_letters l where l.id = p_offer;
  if not found then return null; end if;
  field := public.offer_form_base_field(o.form_id);
  if field is not null then
    v := public.offer_salary_value(o.field_values->>field);
    select f.field_config into cfg from public.offer_form_fields f where f.form_id = o.form_id and f.field_name = field limit 1;
  end if;
  if v is null or (v->>'amount') is null then
    v := public.offer_salary_value(coalesce(o.field_values->>'base_salary', o.field_values->>'salary', o.field_values->>'base_pay'));
  end if;
  if v is null or (v->>'amount') is null or (v->>'amount')::numeric <= 0 then return null; end if;
  select j.tenant_id into tenant from public.jobs j where j.id = o.job_id;
  if (v->>'currency') is null then
    v := v || jsonb_build_object('currency', coalesce(nullif(upper(btrim(coalesce(cfg->>'currency', ''))), ''), 'USD'));
  end if;
  if (v->>'period') is null then
    v := v || jsonb_build_object('period', public.salary_period_guess((v->>'amount')::numeric, v->>'currency', tenant));
  end if;
  return v;
end
$function$;

revoke all on function public.offer_letter_base_salary(uuid) from public, anon;

-- The older reader (field values only) keeps its shape and now passes the period on.
create or replace function public.offer_base_salary(_fv jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  v := public.offer_salary_value(coalesce(_fv->>'base_salary', _fv->>'salary', _fv->>'base_pay'));
  if v is null then return null; end if;
  return jsonb_build_object('amount', (v->>'amount')::numeric, 'currency', v->>'currency', 'period', v->>'period');
end
$function$;

-- 5. The offer a hire stands on: this candidate's offer for this job that wasn't
-- turned down, the one on this opening first, then an accepted one, then the latest.
create or replace function public.hire_offer_for(p_candidate uuid, p_job uuid, p_opening uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.id
    from public.offer_letters l
   where l.candidate_id = p_candidate and l.job_id = p_job
     and coalesce(l.status, '') not in ('declined', 'withdrawn', 'expired', 'rejected', 'cancelled')
   order by (public.offer_letter_base_salary(l.id) is not null) desc,
            (l.opening_id is not distinct from p_opening) desc,
            (l.status = 'accepted') desc,
            l.created_at desc
   limit 1
$function$;

revoke all on function public.hire_offer_for(uuid, uuid, uuid) from public, anon, authenticated;

-- 6. The hired salary, on the opening the hire filled.
alter table public.job_openings
  add column hired_salary_amount numeric,
  add column hired_salary_currency text,
  add column hired_salary_period text,
  add column hired_salary_offer_id uuid;

alter table public.job_openings add constraint job_openings_hired_salary_period_known check (
  hired_salary_period is null or hired_salary_period in ('monthly', 'annually', 'hourly')
);

comment on column public.job_openings.hired_salary_amount is
  'What the person who filled this opening was hired at: their offer''s base salary (hired_salary_currency, hired_salary_period, hired_salary_offer_id). Kept by the database from the offer, never written by the screens.';

-- Filling an opening needs an offer with a base salary, and takes it. Undoing
-- the hire clears it.
create or replace function public.job_openings_hire_salary()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  offer uuid;
  v jsonb;
begin
  if new.hired_association_id is not null and old.hired_association_id is null then
    select c.candidate_id, c.job_id into a from public.job_candidate_associations c where c.id = new.hired_association_id;
    offer := public.hire_offer_for(a.candidate_id, a.job_id, new.id);
    if offer is null then
      raise exception 'Create the offer first: a candidate is marked hired from their offer.' using errcode = 'GHS01';
    end if;
    v := public.offer_letter_base_salary(offer);
    if v is null then
      raise exception 'Add the base salary to the offer first: it becomes the hired salary.' using errcode = 'GHS02';
    end if;
    new.hired_salary_amount := (v->>'amount')::numeric;
    new.hired_salary_currency := v->>'currency';
    new.hired_salary_period := v->>'period';
    new.hired_salary_offer_id := offer;
  elsif new.hired_association_id is null and old.hired_association_id is not null then
    new.hired_salary_amount := null;
    new.hired_salary_currency := null;
    new.hired_salary_period := null;
    new.hired_salary_offer_id := null;
  end if;
  return new;
end
$function$;

create trigger a2_job_openings_hire_salary
  before update of hired_association_id on public.job_openings
  for each row execute function public.job_openings_hire_salary();

-- The hire guard also keeps the hired salary from being written directly.
create or replace function public.job_openings_hire_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon')
     or pg_trigger_depth() > 1
     or coalesce(current_setting('gio.hire_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.hired_association_id is not null or new.filled_at is not null
       or new.sourcer_user_id is not null or new.recruiter_user_id is not null
       or new.hired_salary_amount is not null then
      raise exception 'A new opening can''t start filled. Mark a candidate hired instead.' using errcode = 'GHC01';
    end if;
  elsif new.hired_association_id is distinct from old.hired_association_id
     or new.filled_at is distinct from old.filled_at
     or new.sourcer_user_id is distinct from old.sourcer_user_id
     or new.recruiter_user_id is distinct from old.recruiter_user_id
     or new.hired_salary_amount is distinct from old.hired_salary_amount
     or new.hired_salary_currency is distinct from old.hired_salary_currency
     or new.hired_salary_period is distinct from old.hired_salary_period
     or new.hired_salary_offer_id is distinct from old.hired_salary_offer_id then
    raise exception 'A hire changes only through Mark hired, Undo hire or Change credit.' using errcode = 'GHC01';
  end if;
  return new;
end
$function$;

-- 7. A filled opening follows its offer: a corrected salary, or an offer written
-- after the hire, reaches the opening (and Gio Sales, for an opening it bills).
create or replace function public.hire_salary_sync(p_opening uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o record;
  a record;
  offer uuid;
  v jsonb;
begin
  select * into o from public.job_openings where id = p_opening;
  if not found or o.hired_association_id is null then return false; end if;
  select c.candidate_id, c.job_id into a from public.job_candidate_associations c where c.id = o.hired_association_id;
  offer := public.hire_offer_for(a.candidate_id, a.job_id, o.id);
  if offer is null then return false; end if;
  v := public.offer_letter_base_salary(offer);
  -- An offer that loses its salary never empties a hire's record.
  if v is null then return false; end if;
  if o.hired_salary_amount is not distinct from (v->>'amount')::numeric
     and o.hired_salary_currency is not distinct from (v->>'currency')
     and o.hired_salary_period is not distinct from (v->>'period')
     and o.hired_salary_offer_id is not distinct from offer then
    return false;
  end if;
  perform set_config('gio.hire_write', 'on', true);
  update public.job_openings
     set hired_salary_amount = (v->>'amount')::numeric,
         hired_salary_currency = v->>'currency',
         hired_salary_period = v->>'period',
         hired_salary_offer_id = offer,
         updated_at = now()
   where id = o.id;
  perform set_config('gio.hire_write', 'off', true);
  if o.sales_deal_id is not null
     and (o.hired_salary_amount is distinct from (v->>'amount')::numeric
          or o.hired_salary_currency is distinct from (v->>'currency')
          or o.hired_salary_period is distinct from (v->>'period')) then
    perform public.enqueue_opening_event(o.id, 'opening.salary');
  end if;
  return true;
end
$function$;

revoke all on function public.hire_salary_sync(uuid) from public, anon, authenticated;

create or replace function public.offer_letters_hire_salary()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o record;
begin
  for o in
    select jo.id
      from public.job_openings jo
      join public.job_candidate_associations c on c.id = jo.hired_association_id
     where c.candidate_id = new.candidate_id and c.job_id = new.job_id
  loop
    perform public.hire_salary_sync(o.id);
  end loop;
  return null;
exception when others then
  raise warning 'offer_letters_hire_salary failed: % %', sqlerrm, sqlstate;
  return null;
end
$function$;

create trigger offer_letters_z_hire_salary
  after insert or update of field_values, status, opening_id, form_id on public.offer_letters
  for each row execute function public.offer_letters_hire_salary();

-- 8. What Gio Sales hears. The success fee is a share of the yearly salary, so
-- the salary goes out per year (a monthly one times 12; it used to go out as
-- typed, whatever its period), with the period it was agreed in beside it.
-- A filled opening sends its hired salary; opening.salary says it changed.
create or replace function public.enqueue_opening_event(_opening_id uuid, _event text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE o record; j record; _sal jsonb; _cand text; _status text; _payload jsonb; _offer uuid; _amount numeric;
BEGIN
  SELECT * INTO o FROM public.job_openings WHERE id = _opening_id;
  IF NOT FOUND OR o.sales_deal_id IS NULL THEN RETURN; END IF;
  SELECT * INTO j FROM public.jobs WHERE id = o.job_id;
  SELECT status, candidate_name INTO _status, _cand FROM public.job_openings_with_status WHERE id = _opening_id;
  IF _event IN ('opening.filled', 'opening.offer', 'opening.salary') THEN
    IF o.hired_salary_amount IS NOT NULL THEN
      _sal := jsonb_build_object('amount', o.hired_salary_amount, 'currency', o.hired_salary_currency, 'period', o.hired_salary_period);
    ELSE
      SELECT l.id INTO _offer FROM public.offer_letters l
       WHERE l.opening_id = _opening_id AND coalesce(l.status,'') NOT IN ('withdrawn','declined','expired','rejected','cancelled')
       ORDER BY (l.status = 'accepted') DESC, l.created_at DESC LIMIT 1;
      _sal := public.offer_letter_base_salary(_offer);
    END IF;
    _amount := CASE coalesce(_sal->>'period', 'annually')
      WHEN 'monthly' THEN (_sal->>'amount')::numeric * 12
      WHEN 'hourly' THEN (_sal->>'amount')::numeric * 2080
      ELSE (_sal->>'amount')::numeric END;
  END IF;
  _payload := jsonb_build_object(
    'idempotency_key', 'opening_' || o.id || '_' || _event || '_' || floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    'event', _event, 'deal_id', o.sales_deal_id, 'line_id', o.sales_line_id, 'ats_job_id', j.id,
    'job_title', j.title, 'job_status', j.status::text, 'job_code', j.job_code,
    'opening', jsonb_strip_nulls(jsonb_build_object(
      'opening_id', o.id, 'req_id', o.req_id, 'status', _status,
      'target_hire_date', o.target_hire_date, 'target_start_date', o.target_start_date,
      'candidate_name', _cand,
      'base_salary', CASE WHEN _event IN ('opening.filled', 'opening.offer', 'opening.salary') THEN _amount END,
      'currency', CASE WHEN _event IN ('opening.filled', 'opening.offer', 'opening.salary') THEN coalesce(_sal->>'currency', j.currency) END,
      'salary_period', CASE WHEN _event IN ('opening.filled', 'opening.offer', 'opening.salary') THEN _sal->>'period' END,
      'salary_as_agreed', CASE WHEN _event IN ('opening.filled', 'opening.offer', 'opening.salary') THEN (_sal->>'amount')::numeric END,
      'filled_at', CASE WHEN _event = 'opening.filled' THEN (o.filled_at)::date END,
      'cancel_reason', CASE WHEN _event = 'opening.cancelled' THEN o.cancel_reason END)),
    'hire_team', CASE WHEN _event IN ('opening.filled', 'opening.credit_changed') THEN jsonb_build_object(
      'sourcer', public.ats_person(o.sourcer_user_id), 'recruiter', public.ats_person(o.recruiter_user_id)) END);
  INSERT INTO public.integration_outbox(tenant_id, event, payload, idempotency_key)
  VALUES (o.tenant_id, _event, _payload, _payload->>'idempotency_key')
  ON CONFLICT (idempotency_key) DO NOTHING;
END $function$;

-- 9. The hires, for reports (Intelligence): one row per filled opening you may
-- see, with when they were hired and what at, per month in the base currency.
create or replace function public.market_hires(p_tenant uuid)
returns table(candidate_id uuid, job_id uuid, opening_id uuid, req_id text, hired_on date,
              salary_amount numeric, salary_currency text, salary_period text, salary_month_base numeric)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_base text;
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  v_base := coalesce(public.get_tenant_base_currency(p_tenant), 'USD');

  return query
  select
    a.candidate_id,
    j.id,
    o.id,
    o.req_id,
    (o.filled_at at time zone 'America/Mexico_City')::date,
    o.hired_salary_amount,
    o.hired_salary_currency,
    o.hired_salary_period,
    case
      when public.salary_per_month(o.hired_salary_amount, o.hired_salary_period, o.hired_salary_currency) is null then null
      when upper(coalesce(o.hired_salary_currency, v_base)) = v_base
        then round(public.salary_per_month(o.hired_salary_amount, o.hired_salary_period, o.hired_salary_currency), 2)
      else (select round(b.base_amount, 2)
              from public.convert_to_base(p_tenant,
                     public.salary_per_month(o.hired_salary_amount, o.hired_salary_period, o.hired_salary_currency),
                     upper(o.hired_salary_currency), current_date) b)
    end
  from public.job_openings o
  join public.jobs j on j.id = o.job_id
  join public.job_candidate_associations a on a.id = o.hired_association_id
  where j.tenant_id = p_tenant
    and o.hired_association_id is not null
    and (auth.uid() is null or public.can_access_job_pipeline(j.id))
  order by o.filled_at, o.id;
end
$function$;

revoke all on function public.market_hires(uuid) from public, anon;
grant execute on function public.market_hires(uuid) to authenticated, service_role;

-- 10. A base salary on the two forms that had none (Allan, 2026-11-25).
insert into public.offer_form_fields (form_id, field_name, field_label, field_type, field_config, is_required, display_order, section_key, organization_id)
select f.id, 'base_salary', 'Base Salary', 'salary', jsonb_build_object('currency', 'MXN', 'period', 'monthly', 'base', true), true,
       coalesce((select max(x.display_order) + 1 from public.offer_form_fields x where x.form_id = f.id), 0),
       'compensation',
       (select x.organization_id from public.offer_form_fields x where x.form_id = f.id order by x.display_order limit 1)
  from public.offer_forms f
 where f.name in ('Internal Virgilio Member', 'Standard Full Time Employment Offer Letter w/ variable')
   and not exists (select 1 from public.offer_form_fields x where x.form_id = f.id and x.field_type::text = 'salary');

-- 11. Offers written before this: each Salary value gets the pay period its base
-- salary reads as (by size), so the offer opens showing what it meant. Not an
-- edit: the offers' own triggers stay out of it.
alter table public.offer_letters disable trigger user;

do $fill$
declare
  l record;
  f record;
  base jsonb;
  v jsonb;
  vals jsonb;
begin
  for l in select id, form_id, field_values from public.offer_letters where field_values is not null loop
    base := public.offer_letter_base_salary(l.id);
    if base is null then continue; end if;
    vals := l.field_values;
    for f in
      select x.field_name from public.offer_form_fields x where x.form_id = l.form_id and x.field_type::text = 'salary'
      union select k from (values ('base_salary'), ('salary'), ('base_pay')) t(k)
    loop
      if not (vals ? f.field_name) then continue; end if;
      begin
        v := (vals->>f.field_name)::jsonb;
      exception when others then
        v := null;
      end;
      if v is null or jsonb_typeof(v) <> 'object' or coalesce(v->>'period', '') <> '' then continue; end if;
      if coalesce(v->>'amount', '') = '' then continue; end if;
      v := v || jsonb_build_object('period', base->>'period');
      -- Kept in the shape it was saved in (JSON text, or an object).
      vals := jsonb_set(vals, array[f.field_name],
        case when jsonb_typeof(vals->f.field_name) = 'object' then v else to_jsonb(v::text) end);
    end loop;
    if vals is distinct from l.field_values then
      update public.offer_letters set field_values = vals where id = l.id;
    end if;
  end loop;
end
$fill$;

alter table public.offer_letters enable trigger user;

-- 12. The hires already made: each takes its offer's base salary, where it has
-- an offer (the rest get theirs when their offer is written).
do $hires$
declare
  o record;
begin
  for o in select id from public.job_openings where hired_association_id is not null loop
    perform public.hire_salary_sync(o.id);
  end loop;
end
$hires$;
