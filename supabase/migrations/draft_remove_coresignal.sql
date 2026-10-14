-- Remove what's left of CoreSignal from the database (Allan, 2026-10-14).
-- CoreSignal is no longer part of Gio. Since 2026-10-14 nothing in the app or
-- the edge functions in the repo reads any of this (credits go to
-- sourcing_credits_usage directly; job-ask-gio no longer selects the headline).
--
-- Kept on purpose: candidates whose source is 'coresignal' (8 people) keep that
-- source, and privacy notices still name CoreSignal as where their data came
-- from: a notice has to say where the data was obtained.
--
-- Columns and what goes with them automatically: idx_candidates_coresignal_profile,
-- idx_sourcing_projects_coresignal_cache, the (sourcing_project_id, coresignal_id)
-- unique key and the coresignal_candidate_count default.

drop view public.coresignal_usage;

drop function public.consolidate_coresignal_usage(uuid);
drop function public.increment_coresignal_usage(uuid, timestamp with time zone, text);

-- CoreSignal's salary-research cache: empty, and nothing writes or reads it.
drop function public.cleanup_expired_salary_data();
drop table public.salary_market_data;

alter table public.candidates
  drop column coresignal_collected_at,
  drop column coresignal_connections_count,
  drop column coresignal_headline,
  drop column coresignal_profile_id,
  drop column coresignal_search_score;

alter table public.sourcing_preview_candidates
  drop column coresignal_id,
  drop column coresignal_score;

alter table public.sourcing_projects
  drop column coresignal_search_id,
  drop column coresignal_last_searched_at,
  drop column coresignal_candidate_count,
  drop column coresignal_cache_expires_at;
