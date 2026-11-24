-- Why a job closed (Allan, Go! 2026-11-24). Every close and archive records a
-- reason, the job's unfilled openings (Req IDs) are cancelled with it, and Gio
-- Sales hears about both: each cancelled Req ID through the existing
-- opening.cancelled message (with the reason), and the job itself through a new
-- job.closed message. Reopening a job brings back the openings its close
-- cancelled and tells Gio Sales (opening.reopened, job.reopened).
--
-- The reasons: filled · client_cancelled · on_hold · filled_elsewhere ·
-- role_changed · duplicate · other (needs a note) · not_recorded (a close that
-- named none: an older screen, another tool, or a job closed before this).
-- A close with no reason is never refused: it's recorded as filled when every
-- opening is filled, else not_recorded.
--
-- Who may close stays as it is (the jobs update rules). Mark hired no longer
-- closes jobs from the screens; if anything still does, the job's reason is
-- worked out the same way.

-- 1. The reasons and their words (shared with Gio Sales through the messages).
create or replace function public.job_close_reason_label(p_reason text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case p_reason
    when 'filled' then 'Filled'
    when 'client_cancelled' then 'Client cancelled the search'
    when 'on_hold' then 'On hold'
    when 'filled_elsewhere' then 'Filled elsewhere'
    when 'role_changed' then 'Budget or role changed'
    when 'duplicate' then 'Duplicate or opened by mistake'
    when 'other' then 'Other'
    when 'not_recorded' then 'Not recorded'
  end
$function$;

alter table public.jobs
  add column close_reason text,
  add column close_note text,
  add column closed_at timestamptz,
  add column closed_by uuid;

alter table public.jobs add constraint jobs_close_reason_known check (
  close_reason is null or close_reason in
    ('filled', 'client_cancelled', 'on_hold', 'filled_elsewhere', 'role_changed', 'duplicate', 'other', 'not_recorded')
);
alter table public.jobs add constraint jobs_close_note_length check (close_note is null or length(close_note) <= 500);

comment on column public.jobs.close_reason is
  'Why the job closed or was archived (job_close_reason_label for the words); cleared when it reopens.';

-- Which cancelled openings a close cancelled (reopening brings back only those;
-- an opening cancelled on its own stays cancelled).
alter table public.job_openings add column closed_with_job boolean not null default false;

-- 2. Before the status changes: stamp or clear the reason.
create or replace function public.jobs_close_reason()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  going_out boolean := old.status::text in ('open', 'draft') and new.status::text in ('closed', 'archived');
  coming_back boolean := old.status::text in ('closed', 'archived') and new.status::text in ('open', 'draft');
begin
  if going_out then
    if new.close_reason is null then
      new.close_reason := case
        when exists (select 1 from public.job_openings o where o.job_id = new.id and o.cancelled_at is null)
         and not exists (select 1 from public.job_openings o
                          where o.job_id = new.id and o.cancelled_at is null and o.hired_association_id is null)
        then 'filled' else 'not_recorded' end;
    end if;
    new.close_note := nullif(btrim(coalesce(new.close_note, '')), '');
    if new.close_reason = 'other' and new.close_note is null then
      raise exception 'Say why the job closed.' using errcode = 'GJC01';
    end if;
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif coming_back then
    new.close_reason := null;
    new.close_note := null;
    new.closed_at := null;
    new.closed_by := null;
  else
    -- Closed to archived (or any other change) keeps what the close recorded.
    new.close_reason := old.close_reason;
    new.close_note := old.close_note;
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  end if;
  return new;
end;
$function$;

create trigger a1_jobs_close_reason
  before update of status, close_reason, close_note, closed_at, closed_by on public.jobs
  for each row execute function public.jobs_close_reason();

-- 3. A job's message to Gio Sales, one per deal line linked to it.
create or replace function public.enqueue_job_event(p_job uuid, p_event text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  j record;
  l record;
  key text;
begin
  select * into j from public.jobs where id = p_job;
  if not found then return; end if;
  for l in select * from public.job_sales_lines where job_id = p_job order by created_at loop
    key := 'job_' || p_job || '_' || p_event || '_' || l.line_id || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
    insert into public.integration_outbox (tenant_id, event, payload, idempotency_key)
    values (j.tenant_id, p_event, jsonb_strip_nulls(jsonb_build_object(
      'idempotency_key', key,
      'event', p_event,
      'deal_id', l.deal_id,
      'line_id', l.line_id,
      'ats_job_id', j.id,
      'job_title', j.title,
      'job_status', j.status::text,
      'job_code', j.job_code,
      'close_reason', j.close_reason,
      'close_reason_label', public.job_close_reason_label(j.close_reason),
      'close_note', j.close_note,
      'closed_at', j.closed_at,
      'openings_cancelled', case when p_event = 'job.closed' then (
        select count(*) from public.job_openings o
         where o.job_id = p_job and o.sales_line_id = l.line_id and o.closed_with_job and o.cancelled_at is not null) end
    )), key)
    on conflict (idempotency_key) do nothing;
  end loop;
end;
$function$;

revoke all on function public.enqueue_job_event(uuid, text) from public, anon, authenticated;

-- 4. After the status changes: cancel or bring back the openings, tell Gio Sales.
create or replace function public.jobs_close_openings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o record;
begin
  if old.status::text in ('open', 'draft') and new.status::text in ('closed', 'archived') then
    update public.job_openings
       set cancelled_at = now(),
           cancel_reason = public.job_close_reason_label(new.close_reason),
           closed_with_job = true
     where job_id = new.id and cancelled_at is null and hired_association_id is null;
    perform public.enqueue_job_event(new.id, 'job.closed');
  elsif old.status::text in ('closed', 'archived') and new.status::text in ('open', 'draft') then
    for o in select id from public.job_openings where job_id = new.id and closed_with_job order by position loop
      begin
        update public.job_openings
           set cancelled_at = null, cancel_reason = null, closed_with_job = false
         where id = o.id;
      exception when others then
        -- A deal with no hires left for it keeps the opening cancelled.
        null;
      end;
    end loop;
    perform public.enqueue_job_event(new.id, 'job.reopened');
  end if;
  return null;
end;
$function$;

create trigger jobs_z_close_openings
  after update of status on public.jobs
  for each row execute function public.jobs_close_openings();

-- 5. An opening brought back tells Gio Sales (opening.reopened). The rest of
-- this function is unchanged.
create or replace function public.job_openings_sales_events()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.sales_deal_id is null then return null; end if;
  if old.cancelled_at is null and new.cancelled_at is not null then
    perform public.enqueue_opening_event(new.id, 'opening.cancelled');
  elsif old.cancelled_at is not null and new.cancelled_at is null then
    perform public.enqueue_opening_event(new.id, 'opening.reopened');
  elsif old.hired_association_id is null and new.hired_association_id is not null then
    perform public.enqueue_opening_event(new.id, 'opening.filled');
  elsif old.hired_association_id is not null and new.hired_association_id is null then
    perform public.enqueue_opening_event(new.id, 'opening.unfilled');
  elsif new.hired_association_id is not null
        and (old.sourcer_user_id is distinct from new.sourcer_user_id
             or old.recruiter_user_id is distinct from new.recruiter_user_id) then
    perform public.enqueue_opening_event(new.id, 'opening.credit_changed');
  elsif old.target_hire_date is distinct from new.target_hire_date or old.target_start_date is distinct from new.target_start_date then
    perform public.enqueue_opening_event(new.id, 'opening.dates_changed');
  end if;
  return null;
end
$function$;

-- 6. Jobs closed before reasons (Allan's choice): "Not recorded", and their
-- unfilled openings cancelled as "Closed before reasons were recorded" (only
-- openings not linked to a Gio Sales deal: none of those is open today, and
-- Gio Sales hears nothing). The tables' own triggers stay out of it: this is
-- no edit and sends nothing.
alter table public.jobs disable trigger user;
alter table public.job_openings disable trigger user;

update public.jobs
   set close_reason = 'not_recorded'
 where status::text in ('closed', 'archived') and close_reason is null;

update public.job_openings o
   set cancelled_at = now(),
       cancel_reason = 'Closed before reasons were recorded',
       closed_with_job = true
  from public.jobs j
 where j.id = o.job_id
   and j.status::text in ('closed', 'archived')
   and o.cancelled_at is null
   and o.hired_association_id is null
   and o.sales_deal_id is null;

alter table public.job_openings enable trigger user;
alter table public.jobs enable trigger user;
