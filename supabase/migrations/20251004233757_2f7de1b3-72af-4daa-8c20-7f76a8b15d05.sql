-- ============================================================
-- Phase 2 Cycle 1B: Backfill Legacy Job Candidate Associations
-- ============================================================
-- Create missing associations from job_candidates → job_candidate_associations
-- using deterministic matching strategy
-- ============================================================

DO $$
DECLARE
  inserted_count INTEGER := 0;
  skipped_no_match INTEGER := 0;
  skipped_exists INTEGER := 0;
  ambiguous_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of legacy job_candidate_associations...';
  
  -- Create associations for all legacy job_candidates
  WITH resolved AS (
    SELECT
      jc.id                      AS legacy_id,
      jc.job_id,
      j.organization_id,
      jc.candidate_name,
      -- Match strategy (priority order):
      -- 1) LinkedIn URL (exact, case-insensitive)
      -- 2) (candidate_name, location_country, location_city) exact match
      -- 3) candidate_name only (within same org)
      COALESCE(
        -- Strategy 1: LinkedIn URL match (most reliable if present)
        (SELECT c1.id FROM candidates c1
         WHERE c1.organization_id = j.organization_id
           AND c1.linkedin_url IS NOT NULL
           AND jc.linkedin_url IS NOT NULL
           AND LOWER(TRIM(c1.linkedin_url)) = LOWER(TRIM(jc.linkedin_url))
         LIMIT 1),
        
        -- Strategy 2: Name + Full Location match
        (SELECT c2.id FROM candidates c2
         WHERE c2.organization_id = j.organization_id
           AND c2.candidate_name IS NOT NULL
           AND jc.candidate_name IS NOT NULL
           AND LOWER(TRIM(c2.candidate_name)) = LOWER(TRIM(jc.candidate_name))
           AND COALESCE(LOWER(TRIM(c2.location_country)), '') = COALESCE(LOWER(TRIM(jc.location_country)), '')
           AND COALESCE(LOWER(TRIM(c2.location_city)), '') = COALESCE(LOWER(TRIM(jc.location_city)), '')
         LIMIT 1),
        
        -- Strategy 3: Name only (last resort, within same org)
        (SELECT c3.id FROM candidates c3
         WHERE c3.organization_id = j.organization_id
           AND c3.candidate_name IS NOT NULL
           AND jc.candidate_name IS NOT NULL
           AND LOWER(TRIM(c3.candidate_name)) = LOWER(TRIM(jc.candidate_name))
         LIMIT 1)
      ) AS candidate_id,
      
      -- Get first stage for this job as default
      (SELECT s.id
       FROM job_hiring_stages s
       WHERE s.job_id = jc.job_id
       ORDER BY s.position NULLS LAST, s.created_at
       LIMIT 1) AS stage_id_default,
      
      jc.added_by,
      jc.created_at,
      jc.updated_at
    FROM job_candidates jc
    JOIN jobs j ON j.id = jc.job_id
  ),
  inserted AS (
    INSERT INTO job_candidate_associations (
      job_id,
      candidate_id,
      current_stage_id,
      status,
      added_by,
      created_at,
      updated_at,
      entered_stage_at
    )
    SELECT
      r.job_id,
      r.candidate_id,
      r.stage_id_default,
      'active',
      r.added_by,
      r.created_at,
      r.updated_at,
      r.created_at  -- entered_stage_at = when they were added
    FROM resolved r
    WHERE r.candidate_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM job_candidate_associations a
        WHERE a.job_id = r.job_id 
          AND a.candidate_id = r.candidate_id
      )
    ON CONFLICT (job_id, candidate_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;
  
  -- Count skipped (no match found)
  SELECT COUNT(*) INTO skipped_no_match
  FROM job_candidates jc
  JOIN jobs j ON j.id = jc.job_id
  WHERE NOT EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.organization_id = j.organization_id
      AND (
        -- Has matching linkedin OR name+location OR name
        (c.linkedin_url IS NOT NULL AND jc.linkedin_url IS NOT NULL 
         AND LOWER(TRIM(c.linkedin_url)) = LOWER(TRIM(jc.linkedin_url)))
        OR
        (LOWER(TRIM(c.candidate_name)) = LOWER(TRIM(jc.candidate_name))
         AND COALESCE(LOWER(TRIM(c.location_country)), '') = COALESCE(LOWER(TRIM(jc.location_country)), '')
         AND COALESCE(LOWER(TRIM(c.location_city)), '') = COALESCE(LOWER(TRIM(jc.location_city)), ''))
        OR
        (LOWER(TRIM(c.candidate_name)) = LOWER(TRIM(jc.candidate_name)))
      )
  );
  
  -- Count skipped (already exists)
  SELECT COUNT(*) INTO skipped_exists
  FROM job_candidates jc
  WHERE EXISTS (
    SELECT 1 FROM job_candidate_associations a
    WHERE a.job_id = jc.job_id
      AND EXISTS (
        SELECT 1 FROM candidates c
        JOIN jobs j ON j.id = jc.job_id
        WHERE c.id = a.candidate_id
          AND c.organization_id = j.organization_id
          AND (
            (c.linkedin_url IS NOT NULL AND jc.linkedin_url IS NOT NULL 
             AND LOWER(TRIM(c.linkedin_url)) = LOWER(TRIM(jc.linkedin_url)))
            OR
            (LOWER(TRIM(c.candidate_name)) = LOWER(TRIM(jc.candidate_name)))
          )
      )
  );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ BACKFILL COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Inserted: % new associations', inserted_count;
  RAISE NOTICE 'Skipped (already exists): %', skipped_exists;
  RAISE NOTICE 'Skipped (no match found): %', skipped_no_match;
  RAISE NOTICE '========================================';
  
  IF skipped_no_match > 0 THEN
    RAISE WARNING 'Warning: % legacy records could not be matched to candidates', skipped_no_match;
    RAISE WARNING 'These will be orphaned when job_candidates is dropped';
  END IF;
END $$;