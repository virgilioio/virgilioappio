
-- 1) Add standardized_skills to candidates and job_candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS standardized_skills TEXT[];

ALTER TABLE public.job_candidates
  ADD COLUMN IF NOT EXISTS standardized_skills TEXT[];

-- 2) Add helpful GIN indexes for array overlap queries
CREATE INDEX IF NOT EXISTS idx_candidates_standardized_skills_gin
  ON public.candidates USING GIN (standardized_skills);

CREATE INDEX IF NOT EXISTS idx_job_candidates_standardized_skills_gin
  ON public.job_candidates USING GIN (standardized_skills);

-- Jobs table already has standardized_skills; ensure it’s indexed
CREATE INDEX IF NOT EXISTS idx_jobs_standardized_skills_gin
  ON public.jobs USING GIN (standardized_skills);

-- 3) Backfill standardized_skills from existing skills using standard_skills table
-- Note: standard_skills.synonyms is expected to be lowercased (as used elsewhere). We compare lower(s.skill) to synonyms.
-- If no mapping found, we keep the original skill.

-- Candidates backfill
WITH mapped AS (
  SELECT
    c.id,
    COALESCE(
      ARRAY_AGG(DISTINCT COALESCE(ss.canonical_name, s.skill))
        FILTER (WHERE s.skill IS NOT NULL),
      '{}'::text[]
    ) AS std_skills
  FROM public.candidates c
  LEFT JOIN LATERAL UNNEST(c.skills) AS s(skill) ON true
  LEFT JOIN public.standard_skills ss
    ON ss.canonical_name = s.skill
    OR lower(s.skill) = ANY (ss.synonyms)
  GROUP BY c.id
)
UPDATE public.candidates c
SET standardized_skills = mapped.std_skills
FROM mapped
WHERE c.id = mapped.id;

-- Job candidates backfill
WITH mapped AS (
  SELECT
    jc.id,
    COALESCE(
      ARRAY_AGG(DISTINCT COALESCE(ss.canonical_name, s.skill))
        FILTER (WHERE s.skill IS NOT NULL),
      '{}'::text[]
    ) AS std_skills
  FROM public.job_candidates jc
  LEFT JOIN LATERAL UNNEST(jc.skills) AS s(skill) ON true
  LEFT JOIN public.standard_skills ss
    ON ss.canonical_name = s.skill
    OR lower(s.skill) = ANY (ss.synonyms)
  GROUP BY jc.id
)
UPDATE public.job_candidates jc
SET standardized_skills = mapped.std_skills
FROM mapped
WHERE jc.id = mapped.id;

-- Jobs backfill (only where missing/empty)
WITH mapped AS (
  SELECT
    j.id,
    COALESCE(
      ARRAY_AGG(DISTINCT COALESCE(ss.canonical_name, s.skill))
        FILTER (WHERE s.skill IS NOT NULL),
      '{}'::text[]
    ) AS std_skills
  FROM public.jobs j
  LEFT JOIN LATERAL UNNEST(j.skills) AS s(skill) ON true
  LEFT JOIN public.standard_skills ss
    ON ss.canonical_name = s.skill
    OR lower(s.skill) = ANY (ss.synonyms)
  GROUP BY j.id
)
UPDATE public.jobs j
SET standardized_skills = mapped.std_skills
FROM mapped
WHERE j.id = mapped.id
  AND (j.standardized_skills IS NULL OR cardinality(j.standardized_skills) = 0);
