-- Reset hallucinated enrichment data for candidates processed between 05:38-05:42 on 2026-03-07
-- These were all fed binary garbage instead of real resume text

-- Step 1: Delete hallucinated work experience
DELETE FROM candidate_work_experience 
WHERE candidate_id IN (
  SELECT id FROM candidates 
  WHERE enriched_at >= '2026-03-07T05:38:00+00' 
    AND enriched_at <= '2026-03-07T05:42:00+00'
    AND deleted_at IS NULL
);

-- Step 2: Delete hallucinated education
DELETE FROM candidate_education 
WHERE candidate_id IN (
  SELECT id FROM candidates 
  WHERE enriched_at >= '2026-03-07T05:38:00+00' 
    AND enriched_at <= '2026-03-07T05:42:00+00'
    AND deleted_at IS NULL
);

-- Step 3: Delete hallucinated certifications
DELETE FROM candidate_certifications 
WHERE candidate_id IN (
  SELECT id FROM candidates 
  WHERE enriched_at >= '2026-03-07T05:38:00+00' 
    AND enriched_at <= '2026-03-07T05:42:00+00'
    AND deleted_at IS NULL
);

-- Step 4: Reset the candidates to pending so they can be re-enriched with the fixed extractor
UPDATE candidates 
SET enrichment_status = 'pending', 
    profile_summary = NULL, 
    enriched_at = NULL,
    seniority_level = NULL,
    functional_area = NULL,
    specialization = NULL,
    standardized_title = NULL,
    years_experience = NULL,
    years_in_leadership = NULL,
    years_in_specialization = NULL,
    avg_tenure_months = NULL,
    company_count = NULL,
    standardized_skills = NULL,
    auto_generated_skills = NULL,
    skills_metadata = NULL
WHERE enriched_at >= '2026-03-07T05:38:00+00' 
  AND enriched_at <= '2026-03-07T05:42:00+00'
  AND deleted_at IS NULL;