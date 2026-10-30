-- Old posting links keep working, and bell items open the candidate inside the job.
--
-- 1. When a posting's slug changes, the old slug is remembered
--    (job_posting_old_slugs). posting_current_slug(old) answers the public
--    page with the current slug of the live posting that used it, so an old
--    link lands on the new address. A slug some posting holds now always wins
--    over a remembered one. Old slugs are never erased; nobody reads the table
--    directly.
-- 2. A bell item about a candidate in a job that links to the candidate's
--    general profile (/candidates/{id}, /candidates?openCandidate={id}) is
--    pointed at the in-job profile instead; a scorecard opens its Scorecards
--    tab. Every sender goes through this, so their links don't need copying.

create table if not exists public.job_posting_old_slugs (
  slug text primary key,
  posting_id uuid not null,
  replaced_at timestamptz not null default now()
);

alter table public.job_posting_old_slugs enable row level security;
revoke all on table public.job_posting_old_slugs from public, anon, authenticated;

create index if not exists job_posting_old_slugs_posting on public.job_posting_old_slugs (posting_id);

create or replace function public.job_postings_z_old_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.slug is not null and old.slug <> '' and new.slug is distinct from old.slug then
    insert into public.job_posting_old_slugs (slug, posting_id)
    values (old.slug, new.id)
    on conflict (slug) do update
      set posting_id = excluded.posting_id, replaced_at = now();
  end if;
  return new;
end $$;

revoke execute on function public.job_postings_z_old_slug() from public, anon, authenticated;

create or replace trigger job_postings_z_old_slug
  after update of slug on public.job_postings
  for each row execute function public.job_postings_z_old_slug();

-- The current slug of the live posting (on an open job) that once used _slug;
-- null when a posting holds _slug now, or the posting isn't live.
create or replace function public.posting_current_slug(_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.slug
  from public.job_posting_old_slugs o
  join public.job_postings p on p.id = o.posting_id
  join public.jobs j on j.id = p.job_id
  where o.slug = _slug
    and p.is_active
    and j.status = 'open'
    and p.slug <> _slug
    and not exists (select 1 from public.job_postings x where x.slug = _slug)
$$;

revoke execute on function public.posting_current_slug(text) from public;
grant execute on function public.posting_current_slug(text) to anon, authenticated;

create or replace function public.notifications_a_in_job_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.job_id is not null and new.candidate_id is not null and new.action_url is not null
     and (new.action_url = '/candidates/' || new.candidate_id
          or new.action_url = '/candidates?openCandidate=' || new.candidate_id) then
    new.action_url := '/jobs/' || new.job_id || '/candidates/' || new.candidate_id
      || case when new.category = 'scorecard_submitted' then '?tab=scorecards' else '' end;
  end if;
  return new;
end $$;

revoke execute on function public.notifications_a_in_job_link() from public, anon, authenticated;

create or replace trigger notifications_a_in_job_link
  before insert on public.notifications
  for each row execute function public.notifications_a_in_job_link();
