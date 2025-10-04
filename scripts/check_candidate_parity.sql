-- ============================================================
-- Phase 2 Cycle 1: Candidate Data Model Parity Checks
-- ============================================================
-- Run these queries BEFORE and AFTER sync to verify data integrity
-- Expected: All counts should match after successful sync
-- ============================================================

-- ============================================================
-- 1. PER-ORGANIZATION CANDIDATE COUNTS
-- ============================================================

SELECT '=== Per-Organization Counts ===' AS section;

-- Modern model (via associations)
SELECT 
  'Modern (associations)' AS model,
  j.organization_id,
  COUNT(DISTINCT jca.candidate_id) AS unique_candidates,
  COUNT(*) AS total_associations
FROM job_candidate_associations jca
JOIN jobs j ON j.id = jca.job_id
GROUP BY j.organization_id
ORDER BY j.organization_id;

-- Legacy model
SELECT 
  'Legacy (job_candidates)' AS model,
  j.organization_id,
  COUNT(DISTINCT jc.id) AS unique_candidates,
  COUNT(*) AS total_records
FROM job_candidates jc
JOIN jobs j ON j.id = jc.job_id
GROUP BY j.organization_id
ORDER BY j.organization_id;

-- ============================================================
-- 2. PER-JOB CANDIDATE COUNTS
-- ============================================================

SELECT '=== Per-Job Counts ===' AS section;

-- Modern model
SELECT 
  'Modern (associations)' AS model,
  job_id,
  COUNT(*) AS candidate_count
FROM job_candidate_associations
GROUP BY job_id
ORDER BY job_id
LIMIT 20;

-- Legacy model
SELECT 
  'Legacy (job_candidates)' AS model,
  job_id,
  COUNT(*) AS candidate_count
FROM job_candidates
GROUP BY job_id
ORDER BY job_id
LIMIT 20;

-- ============================================================
-- 3. RECENT ACTIVITY (30-DAY WINDOW FOR METRICS)
-- ============================================================

SELECT '=== Recent Activity (30 days) ===' AS section;

-- Modern model (associations created in last 30 days)
SELECT 
  'Modern (associations)' AS model,
  j.organization_id,
  COUNT(DISTINCT jca.candidate_id) AS recent_candidates
FROM job_candidate_associations jca
JOIN jobs j ON j.id = jca.job_id
WHERE jca.created_at >= NOW() - INTERVAL '30 days'
GROUP BY j.organization_id
ORDER BY j.organization_id;

-- Legacy model (candidates added in last 30 days)
SELECT 
  'Legacy (job_candidates)' AS model,
  j.organization_id,
  COUNT(DISTINCT jc.id) AS recent_candidates
FROM job_candidates jc
JOIN jobs j ON j.id = jc.job_id
WHERE jc.created_at >= NOW() - INTERVAL '30 days'
GROUP BY j.organization_id
ORDER BY j.organization_id;

-- ============================================================
-- 4. TOTAL COUNTS (SANITY CHECK)
-- ============================================================

SELECT '=== Total Counts ===' AS section;

SELECT 
  'Independent candidates' AS table_name,
  COUNT(*) AS total_count,
  COUNT(DISTINCT id) AS unique_ids
FROM candidates;

SELECT 
  'Job candidate associations' AS table_name,
  COUNT(*) AS total_count,
  COUNT(DISTINCT candidate_id) AS unique_candidate_ids,
  COUNT(DISTINCT job_id) AS unique_job_ids
FROM job_candidate_associations;

SELECT 
  'Legacy job_candidates' AS table_name,
  COUNT(*) AS total_count,
  COUNT(DISTINCT id) AS unique_ids,
  COUNT(DISTINCT job_id) AS unique_job_ids
FROM job_candidates;

-- ============================================================
-- 5. DELTA DETECTION (CRITICAL)
-- ============================================================

SELECT '=== Delta Detection ===' AS section;

-- Find jobs with mismatched counts
WITH modern_counts AS (
  SELECT job_id, COUNT(*) AS modern_count
  FROM job_candidate_associations
  GROUP BY job_id
),
legacy_counts AS (
  SELECT job_id, COUNT(*) AS legacy_count
  FROM job_candidates
  GROUP BY job_id
)
SELECT 
  COALESCE(m.job_id, l.job_id) AS job_id,
  COALESCE(m.modern_count, 0) AS modern_count,
  COALESCE(l.legacy_count, 0) AS legacy_count,
  COALESCE(l.legacy_count, 0) - COALESCE(m.modern_count, 0) AS delta,
  CASE 
    WHEN COALESCE(m.modern_count, 0) = COALESCE(l.legacy_count, 0) THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END AS status
FROM modern_counts m
FULL OUTER JOIN legacy_counts l ON m.job_id = l.job_id
WHERE COALESCE(m.modern_count, 0) != COALESCE(l.legacy_count, 0)
ORDER BY ABS(COALESCE(l.legacy_count, 0) - COALESCE(m.modern_count, 0)) DESC
LIMIT 20;

-- ============================================================
-- 6. ORPHANED RECORDS DETECTION
-- ============================================================

SELECT '=== Orphaned Records ===' AS section;

-- Associations without a valid candidate in candidates table
SELECT 
  'Orphaned associations (missing candidate)' AS issue_type,
  COUNT(*) AS count
FROM job_candidate_associations jca
WHERE NOT EXISTS (
  SELECT 1 FROM candidates c WHERE c.id = jca.candidate_id
);

-- Associations without a valid job
SELECT 
  'Orphaned associations (missing job)' AS issue_type,
  COUNT(*) AS count
FROM job_candidate_associations jca
WHERE NOT EXISTS (
  SELECT 1 FROM jobs j WHERE j.id = jca.job_id
);

-- ============================================================
-- EXPECTED RESULTS AFTER SUCCESSFUL SYNC:
-- ============================================================
-- - All per-org counts should match
-- - All per-job counts should match
-- - Delta detection should show 0 mismatches
-- - Orphaned records should be 0
-- ============================================================
