-- Draft metadata.
alter table public.jobs
  add column if not exists draft_step smallint check (draft_step between 1 and 5),
  add column if not exists last_edited_by uuid references auth.users(id),
  add column if not exists draft_source text generated always as
    (case when sales_deal_id is not null then 'sales' else 'wizard' end) stored;

create or replace function public.jobs_track_editor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.last_edited_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists jobs_track_editor on public.jobs;
create trigger jobs_track_editor before update on public.jobs
  for each row execute function public.jobs_track_editor();

create or replace function public.job_setup_checks(p_job uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j record; r jsonb; missing text[] := '{}';
  v_info bool; v_open bool; v_plan bool; v_team bool; v_attr bool;
begin
  select * into j from public.jobs where id = p_job;
  if j.id is null then return null; end if;
  v_info := coalesce(trim(j.title), '') <> '' and (j.department_id is not null or coalesce(trim(j.department), '') <> '');
  v_open := exists (select 1 from public.job_openings o where o.job_id = j.id and o.cancelled_at is null);
  v_plan := exists (select 1 from public.job_hiring_stages s where s.job_id = j.id);
  v_team := exists (select 1 from public.job_assignments a where a.job_id = j.id and a.deleted_at is null);
  if not v_info then missing := missing || 'Job info'; end if;
  if not v_open then missing := missing || 'Openings'; end if;
  if not v_plan then missing := missing || 'Hiring plan'; end if;
  if not v_team then missing := missing || 'Hiring team'; end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = j.id and a.role = 'sourcer' and a.deleted_at is null) then missing := missing || 'Sourcing Partner'; end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = j.id and a.role = 'recruiter' and a.deleted_at is null) then missing := missing || 'TA Partner'; end if;
  if j.sales_deal_id is not null then
    if jsonb_array_length(coalesce(j.sales_team -> 'sales', '[]'::jsonb)) = 0 then missing := missing || 'Sales'; end if;
    if jsonb_array_length(coalesce(j.sales_team -> 'es', '[]'::jsonb)) = 0 then missing := missing || 'Engagement Specialist'; end if;
  end if;
  v_attr := not (missing && array['Sourcing Partner', 'TA Partner', 'Sales', 'Engagement Specialist']);
  return jsonb_build_object('job_info', v_info, 'openings', v_open, 'hiring_plan', v_plan, 'hiring_team', v_team,
                            'attribution', v_attr, 'missing', to_jsonb(missing));
end $$;
grant execute on function public.job_setup_checks(uuid) to authenticated;

create or replace function public.jobs_publish_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare c jsonb; m text;
begin
  if new.status = 'open' and old.status = 'draft' then
    c := public.job_setup_checks(new.id);
    if jsonb_array_length(c -> 'missing') > 0 then
      select string_agg(x, ', ') into m from jsonb_array_elements_text(c -> 'missing') x;
      raise exception 'Complete the setup before publishing: %.', m;
    end if;
    new.draft_step := null;
  end if;
  return new;
end $$;

create or replace function public.jobs_protect_sales_draft() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.sales_deal_id is not null and old.status = 'draft' then
    if tg_op = 'DELETE' or (new.deleted_at is not null and old.deleted_at is null) or new.status = 'archived' then
      raise exception 'This draft was created from a Gio Sales deal and can''t be discarded here. Cancel it from the deal in Gio Sales.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists jobs_protect_sales_draft on public.jobs;
create trigger jobs_protect_sales_draft before update or delete on public.jobs
  for each row execute function public.jobs_protect_sales_draft();

select cron.schedule('archive-stale-wizard-drafts', '30 4 * * *',
  $$update public.jobs set status = 'archived'
     where status = 'draft' and sales_deal_id is null and deleted_at is null
       and updated_at < now() - interval '60 days'$$);