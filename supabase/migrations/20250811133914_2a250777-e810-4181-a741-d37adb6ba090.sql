
-- 1) Enum for score options
create type public.score_rating_enum as enum ('definitely_no', 'no', 'yes', 'strong_yes');

-- 2) Scorecards table
create table public.job_stage_scorecards (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.job_candidate_associations(id) on delete cascade,
  stage_instance_id uuid not null references public.job_hiring_stages(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  rating public.score_rating_enum not null,
  general_overview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniq_author_per_assoc_stage unique (association_id, stage_instance_id, created_by)
);

create index on public.job_stage_scorecards (association_id);
create index on public.job_stage_scorecards (stage_instance_id);
create index on public.job_stage_scorecards (job_id);
create index on public.job_stage_scorecards (created_by);

-- 3) Trigger: validate and assign derived refs
create or replace function public.validate_and_assign_scorecard_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assoc_job uuid;
  assoc_candidate uuid;
  stage_job uuid;
begin
  -- Load association
  select job_id, candidate_id
  into assoc_job, assoc_candidate
  from public.job_candidate_associations
  where id = new.association_id;

  if assoc_job is null then
    raise exception 'Invalid association_id';
  end if;

  -- Load stage job
  select job_id
  into stage_job
  from public.job_hiring_stages
  where id = new.stage_instance_id;

  if stage_job is null then
    raise exception 'Invalid stage_instance_id';
  end if;

  if assoc_job <> stage_job then
    raise exception 'Stage instance does not belong to the same job as the association';
  end if;

  -- Assign derived columns
  new.job_id := assoc_job;
  new.candidate_id := assoc_candidate;

  -- Ensure created_by default on insert
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger trg_assign_scorecard_refs
before insert or update on public.job_stage_scorecards
for each row execute function public.validate_and_assign_scorecard_refs();

-- updated_at management
create trigger trg_job_stage_scorecards_updated_at
before update on public.job_stage_scorecards
for each row execute function public.handle_updated_at();

-- 4) RLS
alter table public.job_stage_scorecards enable row level security;

-- SELECT: org members of job OR job assignees OR platform admin
create policy "Members/assignees can view scorecards"
on public.job_stage_scorecards
for select
using (
  exists (
    select 1
    from public.job_candidate_associations jca
    join public.jobs j on j.id = jca.job_id
    join public.members m on m.organization_id = j.organization_id
    where jca.id = job_stage_scorecards.association_id
      and m.user_id = auth.uid()
      and m.user_status = 'active'
  )
  or exists (
    select 1
    from public.job_candidate_associations jca
    join public.job_assignments ja on ja.job_id = jca.job_id
    where jca.id = job_stage_scorecards.association_id
      and ja.user_id = auth.uid()
  )
  or public.get_user_type_secure() = 'platform_admin'
);

-- INSERT: same access + author = auth.uid()
create policy "Members/assignees can insert own scorecards"
on public.job_stage_scorecards
for insert
with check (
  new.created_by = auth.uid()
  and (
    exists (
      select 1
      from public.job_candidate_associations jca
      join public.jobs j on j.id = jca.job_id
      join public.members m on m.organization_id = j.organization_id
      where jca.id = new.association_id
        and m.user_id = auth.uid()
        and m.user_status = 'active'
    )
    or exists (
      select 1
      from public.job_candidate_associations jca
      join public.job_assignments ja on ja.job_id = jca.job_id
      where jca.id = new.association_id
        and ja.user_id = auth.uid()
    )
    or public.get_user_type_secure() = 'platform_admin'
  )
);

-- UPDATE: only author or platform admin
create policy "Authors/admin can update scorecards"
on public.job_stage_scorecards
for update
using (created_by = auth.uid() or public.get_user_type_secure() = 'platform_admin')
with check (created_by = auth.uid() or public.get_user_type_secure() = 'platform_admin');

-- DELETE: only author or platform admin (optional)
create policy "Authors/admin can delete scorecards"
on public.job_stage_scorecards
for delete
using (created_by = auth.uid() or public.get_user_type_secure() = 'platform_admin');
