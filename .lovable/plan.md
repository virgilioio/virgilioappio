

# Cache Suggested Candidates to Eliminate Repeated AI Scoring

## Problem

Every time you open the Suggested Candidates tab, the edge function fetches up to 50 candidates and sends them through GPT-4o-mini in batches of 10. With 5 batches of AI calls, this takes 15-30+ seconds. There's **no caching** — the same expensive AI scoring runs from scratch every single time.

## Solution

Store AI scoring results in a new database table. The edge function checks the cache first and only re-scores when the job description/skills change or new candidates appear.

## Database change

Create a `job_suggested_candidates_cache` table:

```sql
create table public.job_suggested_candidates_cache (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  candidate_id uuid references public.candidates(id) on delete cascade not null,
  ai_fit_score integer not null,
  ai_fit_confidence text,
  ai_fit_rationale text,
  job_skills_hash text not null,  -- detect when job changes
  scored_at timestamptz default now(),
  unique (job_id, candidate_id)
);

alter table public.job_suggested_candidates_cache enable row level security;

create policy "Authenticated users can read cache"
  on public.job_suggested_candidates_cache for select
  to authenticated using (true);

create index idx_suggested_cache_job on public.job_suggested_candidates_cache(job_id);
```

## Edge function changes (`get-suggested-candidates/index.ts`)

1. **Compute a `skills_hash`** from `job.skills + job.title + first 500 chars of description` (simple MD5 or sorted join)
2. **Check cache**: Query `job_suggested_candidates_cache` for this `job_id` where `job_skills_hash = current_hash` and `scored_at > now() - interval '24 hours'`
3. **If cache hit**: Join cached scores with `candidates` table to get fresh profile data, return immediately (< 1 second)
4. **If cache miss**: Run the existing AI scoring flow, then **upsert** results into the cache table before returning
5. **Invalidation**: Cache auto-expires after 24 hours. If job skills/description change, the hash changes and triggers a fresh score

## Client-side change (`useJobSuggestedCandidates.ts`)

No logic changes needed — the hook already calls the edge function. The speedup is entirely server-side.

## Result

| Scenario | Before | After |
|----------|--------|-------|
| First open | 15-30s (AI scoring) | 15-30s (AI scoring, cached for next time) |
| Subsequent opens | 15-30s (AI scoring again) | < 1s (cache hit) |
| After editing job skills | 15-30s | 15-30s (cache miss, new hash) |
| After 24 hours | 15-30s | 15-30s (cache expired, refreshed) |

