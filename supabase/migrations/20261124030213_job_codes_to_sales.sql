-- Job IDs reach Gio Sales (Allan, Go! 2026-11-24). A deal's search line is a job
-- here and a link on the deal there; the link keeps the job's ID (VG-XXXX)
-- beside its openings' Req IDs, which stay the seats that are billed.
--
-- 1. The reply to a won deal (sales_deal_won) names each line's job_code, so a
--    job the deal makes is linked with its ID at once.
-- 2. Every opening event names it too (enqueue_opening_event), so a link
--    missing it catches up on the next event.
-- 3. Each job already linked to a deal sends it once (job.identified).
--
-- Both functions are changed in place, only by adding the one key; the
-- migration stops if either doesn't read as expected.

do $patch$
declare
  def text;
  old_part text;
  new_part text;
begin
  def := pg_get_functiondef('public.sales_deal_won(uuid,jsonb)'::regprocedure);
  old_part := '''job_status'', _job.status::text, ''openings'', _openings';
  new_part := '''job_status'', _job.status::text, ''job_code'', _job.job_code, ''openings'', _openings';
  if position(old_part in def) = 0 then
    raise exception 'sales_deal_won does not read as expected';
  end if;
  execute replace(def, old_part, new_part);

  def := pg_get_functiondef('public.enqueue_opening_event(uuid,text)'::regprocedure);
  old_part := '''job_title'', j.title, ''job_status'', j.status::text,';
  new_part := '''job_title'', j.title, ''job_status'', j.status::text, ''job_code'', j.job_code,';
  if position(old_part in def) = 0 then
    raise exception 'enqueue_opening_event does not read as expected';
  end if;
  execute replace(def, old_part, new_part);
end
$patch$;

-- Links made before Job IDs: one message per deal line with its job's ID.
insert into public.integration_outbox (tenant_id, event, payload, idempotency_key)
select l.tenant_id, 'job.identified',
       jsonb_build_object(
         'idempotency_key', 'job_identified_' || l.line_id,
         'event', 'job.identified',
         'deal_id', l.deal_id,
         'line_id', l.line_id,
         'ats_job_id', j.id,
         'job_title', j.title,
         'job_status', j.status::text,
         'job_code', j.job_code),
       'job_identified_' || l.line_id
from public.job_sales_lines l
join public.jobs j on j.id = l.job_id
on conflict (idempotency_key) do nothing;
