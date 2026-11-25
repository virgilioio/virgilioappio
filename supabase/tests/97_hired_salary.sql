-- The hired salary: a hire needs an offer with a base salary, the opening keeps
-- it (with its own pay period), follows the offer when it's corrected, and gives
-- it up when the hire is undone. Gio Sales gets the yearly figure. Reports read
-- it through market_hires(). Ends by raising its result: nothing is kept.
do $t$
declare
  tpl record;
  form uuid;
  job uuid;
  cand uuid;
  assoc uuid;
  opening uuid;
  offer uuid;
  rec record;
  n int;
  r text := '';
begin
  select * into tpl from public.jobs where status::text = 'open' and tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' order by created_at desc limit 1;
  select id into form from public.offer_forms where name = 'Standard Offer Form - Sales';
  select id into cand from public.candidates where tenant_id = tpl.tenant_id and merged_into is null order by created_at desc limit 1;
  insert into public.jobs (title, tenant_id, organization_id, status, currency, created_by)
  values ('Hired salary test', tpl.tenant_id, tpl.organization_id, 'draft', 'MXN', tpl.created_by) returning id into job;
  insert into public.job_sales_lines (tenant_id, job_id, deal_id, line_id, hires) values (tpl.tenant_id, job, gen_random_uuid(), gen_random_uuid(), 1);
  insert into public.job_openings (job_id, tenant_id, position, target_hire_date, target_start_date)
  values (job, tpl.tenant_id, 0, current_date + 30, current_date + 60) returning id into opening;
  insert into public.job_candidate_associations (candidate_id, job_id, status) values (cand, job, 'offer') returning id into assoc;

  -- No offer: no hire.
  begin
    update public.job_openings set hired_association_id = assoc, filled_at = now() where id = opening;
    r := 'needs_offer=false';
  exception when others then
    r := 'needs_offer=' || (sqlstate = 'GHS01');
  end;

  -- An offer with no base salary: no hire.
  insert into public.offer_letters (candidate_id, job_id, organization_id, title, form_id, status, field_values)
  values (cand, job, tpl.organization_id, 'Offer', form, 'draft', jsonb_build_object('job_title', 'Tester')) returning id into offer;
  begin
    update public.job_openings set hired_association_id = assoc, filled_at = now() where id = opening;
    r := r || ' needs_salary=false';
  exception when others then
    r := r || ' needs_salary=' || (sqlstate = 'GHS02');
  end;

  -- A base salary with its period: the hire takes it.
  update public.offer_letters set field_values = field_values || jsonb_build_object('base_salary', '{"amount":"40000","currency":"MXN","period":"monthly"}') where id = offer;
  update public.job_openings set hired_association_id = assoc, filled_at = now() where id = opening;
  select * into rec from public.job_openings where id = opening;
  r := r || ' hire_takes_salary=' || (rec.hired_salary_amount = 40000 and rec.hired_salary_currency = 'MXN' and rec.hired_salary_period = 'monthly' and rec.hired_salary_offer_id = offer);
  select count(*) into n from public.integration_outbox
   where event = 'opening.filled' and payload->'opening'->>'opening_id' = opening::text
     and (payload->'opening'->>'base_salary')::numeric = 480000 and payload->'opening'->>'salary_period' = 'monthly'
     and (payload->'opening'->>'salary_as_agreed')::numeric = 40000;
  r := r || ' sales_gets_yearly=' || (n = 1);

  -- A corrected offer reaches the hire, and Gio Sales.
  update public.offer_letters set field_values = field_values || jsonb_build_object('base_salary', '{"amount":"45000","currency":"MXN","period":"monthly"}') where id = offer;
  r := r || ' follows_offer=' || ((select hired_salary_amount from public.job_openings where id = opening) = 45000);
  select count(*) into n from public.integration_outbox
   where event = 'opening.salary' and payload->'opening'->>'opening_id' = opening::text and (payload->'opening'->>'base_salary')::numeric = 540000;
  r := r || ' sales_hears_change=' || (n = 1);

  -- A value with no period of its own is read by its size.
  update public.offer_letters set field_values = field_values || jsonb_build_object('base_salary', '{"amount":"135000","currency":"USD"}') where id = offer;
  select * into rec from public.job_openings where id = opening;
  r := r || ' old_value_by_size=' || (rec.hired_salary_amount = 135000 and rec.hired_salary_period = 'annually');
  r := r || ' small_is_monthly=' || (public.salary_period_guess(40000, 'MXN', tpl.tenant_id) = 'monthly' and public.salary_period_guess(480000, 'MXN', tpl.tenant_id) = 'annually');

  -- An offer that loses its salary never empties the hire.
  update public.offer_letters set field_values = field_values - 'base_salary' where id = offer;
  r := r || ' never_emptied=' || ((select hired_salary_amount from public.job_openings where id = opening) = 135000);

  -- Reports.
  update public.offer_letters set field_values = field_values || jsonb_build_object('base_salary', '{"amount":"480000","currency":"MXN","period":"annually"}') where id = offer;
  select * into rec from public.market_hires(tpl.tenant_id) where opening_id = opening;
  r := r || ' report_row=' || (rec.salary_month_base = 40000 and rec.hired_on is not null and rec.candidate_id = cand);

  -- Undoing the hire clears it.
  update public.job_openings set hired_association_id = null, filled_at = null where id = opening;
  r := r || ' undo_clears=' || ((select hired_salary_amount is null and hired_salary_offer_id is null from public.job_openings where id = opening));

  -- The forms, the older offers and the hires already made.
  select count(*) into n from public.offer_forms f
   where f.is_active and not exists (select 1 from public.offer_form_fields x where x.form_id = f.id and x.field_type::text = 'salary');
  r := r || ' every_form_has_salary=' || (n = 0);
  r := r || ' base_field=' || (public.offer_form_base_field(form) = 'base_salary');
  select count(*) into n from public.offer_letters l
   where l.id <> offer and public.offer_letter_base_salary(l.id) is not null
     and coalesce(public.offer_salary_value(coalesce(l.field_values->>public.offer_form_base_field(l.form_id), l.field_values->>'base_salary'))->>'period', '') = '';
  r := r || ' older_offers_have_period=' || (n = 0);
  select count(*) into n from public.job_openings where hired_association_id is not null and hired_salary_amount is not null;
  r := r || ' hires_with_salary=' || n;
  r := r || ' triggers_on=' || (not exists (select 1 from pg_trigger where tgrelid in ('public.offer_letters'::regclass, 'public.job_openings'::regclass) and not tgisinternal and tgenabled <> 'O'));
  raise exception 'RESULT %', r;
end $t$;
