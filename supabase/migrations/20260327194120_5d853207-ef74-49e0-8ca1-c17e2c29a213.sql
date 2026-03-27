create table public.job_suggested_candidates_cache (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  candidate_id uuid references public.candidates(id) on delete cascade not null,
  ai_fit_score integer not null,
  ai_fit_confidence text,
  ai_fit_rationale text,
  job_skills_hash text not null,
  scored_at timestamptz default now(),
  unique (job_id, candidate_id)
);

alter table public.job_suggested_candidates_cache enable row level security;

create policy "Authenticated users can read cache"
  on public.job_suggested_candidates_cache for select
  to authenticated using (true);

create policy "Service role can manage cache"
  on public.job_suggested_candidates_cache for all
  to service_role using (true);

create index idx_suggested_cache_job on public.job_suggested_candidates_cache(job_id);
create index idx_suggested_cache_hash on public.job_suggested_candidates_cache(job_id, job_skills_hash);