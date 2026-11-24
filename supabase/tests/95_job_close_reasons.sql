-- Why a job closed: the reason is recorded, unfilled openings are cancelled with
-- it (not one cancelled on its own), Gio Sales gets the job and each Req ID,
-- archive keeps the reason, reopening brings the openings back, and older
-- closed jobs read "Not recorded". Ends by raising its result: nothing is kept.
do $t$
declare
  tpl record;
  job uuid;
  line uuid := gen_random_uuid();
  o1 uuid; o2 uuid; o3 uuid;
  rec record;
  n int;
  r text := '';
begin
  select * into tpl from public.jobs where status::text = 'open' order by created_at desc limit 1;
  insert into public.jobs (title, tenant_id, organization_id, status, currency, created_by)
  values ('Close reason test', tpl.tenant_id, tpl.organization_id, 'draft', 'USD', tpl.created_by)
  returning id into job;
  insert into public.job_sales_lines (tenant_id, job_id, deal_id, line_id, hires)
  values (tpl.tenant_id, job, gen_random_uuid(), line, 3);
  insert into public.job_openings (job_id, tenant_id, position, target_hire_date, target_start_date) values (job, tpl.tenant_id, 0, current_date + 30, current_date + 60) returning id into o1;
  insert into public.job_openings (job_id, tenant_id, position, target_hire_date, target_start_date) values (job, tpl.tenant_id, 1, current_date + 30, current_date + 60) returning id into o2;
  insert into public.job_openings (job_id, tenant_id, position, target_hire_date, target_start_date) values (job, tpl.tenant_id, 2, current_date + 30, current_date + 60) returning id into o3;
  update public.job_openings set cancelled_at = now(), cancel_reason = 'Cancelled on its own' where id = o3;
  r := 'setup=' || ((select count(*) from public.job_openings where job_id = job and sales_line_id = line) = 3);

  -- Other needs a note.
  begin
    update public.jobs set status = 'closed', close_reason = 'other' where id = job;
    r := r || ' other_needs_note=false';
  exception when others then
    r := r || ' other_needs_note=' || (sqlstate = 'GJC01');
  end;

  -- Close with a reason.
  update public.jobs set status = 'closed', close_reason = 'client_cancelled', close_note = '  Budget frozen  ' where id = job;
  select * into rec from public.jobs where id = job;
  r := r || ' reason_kept=' || (rec.close_reason = 'client_cancelled' and rec.close_note = 'Budget frozen' and rec.closed_at is not null);
  select count(*) into n from public.job_openings
   where job_id = job and closed_with_job and cancelled_at is not null and cancel_reason = 'Client cancelled the search';
  r := r || ' unfilled_cancelled=' || (n = 2);
  r := r || ' own_cancel_untouched=' || exists (select 1 from public.job_openings where id = o3 and not closed_with_job and cancel_reason = 'Cancelled on its own');
  select count(*) into n from public.integration_outbox
   where event = 'opening.cancelled' and payload->>'ats_job_id' = job::text
     and payload->'opening'->>'cancel_reason' = 'Client cancelled the search';
  r := r || ' sales_hears_each_req=' || (n = 2);
  select count(*) into n from public.integration_outbox
   where event = 'job.closed' and payload->>'ats_job_id' = job::text and payload->>'line_id' = line::text
     and payload->>'close_reason' = 'client_cancelled' and payload->>'close_reason_label' = 'Client cancelled the search'
     and payload->>'close_note' = 'Budget frozen' and (payload->>'openings_cancelled')::int = 2;
  r := r || ' sales_hears_job=' || (n = 1);

  -- Archiving a closed job keeps its reason.
  update public.jobs set status = 'archived', close_reason = 'on_hold' where id = job;
  r := r || ' archive_keeps_reason=' || ((select close_reason from public.jobs where id = job) = 'client_cancelled');

  -- Reopening brings back what the close cancelled, and says so.
  update public.jobs set status = 'draft' where id = job;
  select * into rec from public.jobs where id = job;
  r := r || ' reopen_clears=' || (rec.close_reason is null and rec.close_note is null and rec.closed_at is null);
  select count(*) into n from public.job_openings where job_id = job and cancelled_at is null and not closed_with_job;
  r := r || ' openings_back=' || (n = 2);
  r := r || ' own_cancel_stays=' || exists (select 1 from public.job_openings where id = o3 and cancelled_at is not null);
  select count(*) into n from public.integration_outbox where event = 'opening.reopened' and payload->>'ats_job_id' = job::text;
  r := r || ' sales_hears_reopened_reqs=' || (n = 2);
  select count(*) into n from public.integration_outbox where event = 'job.reopened' and payload->>'ats_job_id' = job::text;
  r := r || ' sales_hears_reopen=' || (n = 1);

  -- A close that names no reason is recorded, never refused.
  update public.jobs set status = 'closed' where id = job;
  r := r || ' no_reason_not_recorded=' || ((select close_reason from public.jobs where id = job) = 'not_recorded');

  -- Jobs closed before reasons.
  select count(*) into n from public.jobs where status::text in ('closed', 'archived') and close_reason is null;
  r := r || ' old_closed_have_reason=' || (n = 0);
  select count(*) into n from public.job_openings o join public.jobs j on j.id = o.job_id
   where j.status::text in ('closed', 'archived') and o.cancelled_at is null and o.hired_association_id is null and o.sales_deal_id is null;
  r := r || ' old_open_reqs_cancelled=' || (n = 0);
  r := r || ' labels=' || (public.job_close_reason_label('filled_elsewhere') = 'Filled elsewhere' and public.job_close_reason_label('nope') is null);
  r := r || ' triggers_on=' || (not exists (select 1 from pg_trigger where tgrelid in ('public.jobs'::regclass, 'public.job_openings'::regclass) and not tgisinternal and tgenabled <> 'O'));

  raise exception 'RESULT %', r;
end $t$;
