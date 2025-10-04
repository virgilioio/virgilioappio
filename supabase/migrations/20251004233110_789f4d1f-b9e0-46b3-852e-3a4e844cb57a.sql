-- ============================================================
-- Phase 2 Cycle 1: Direct Data Sync (Inline, No Function)
-- ============================================================
-- Directly sync data without calling the RPC function
-- ============================================================

DO $$
DECLARE
  sync_count integer := 0;
  skip_count integer := 0;
  candidate_record RECORD;
  existing_candidate_id uuid;
BEGIN
  RAISE NOTICE 'Starting candidate sync...';
  
  -- Loop through all unique job candidates
  FOR candidate_record IN 
    SELECT DISTINCT ON (candidate_name, COALESCE(location_country, ''), COALESCE(location_city, ''))
      id,
      candidate_name,
      location_country,
      location_state, 
      location_city,
      salary_amount,
      salary_currency,
      salary_period,
      profile_summary,
      linkedin_url,
      skills,
      added_by,
      created_at,
      updated_at
    FROM public.job_candidates
    ORDER BY candidate_name, COALESCE(location_country, ''), COALESCE(location_city, ''), created_at ASC
  LOOP
    -- Check if candidate already exists
    SELECT id INTO existing_candidate_id
    FROM public.candidates
    WHERE candidate_name = candidate_record.candidate_name
      AND COALESCE(location_country, '') = COALESCE(candidate_record.location_country, '')
      AND COALESCE(location_city, '') = COALESCE(candidate_record.location_city, '');

    IF existing_candidate_id IS NULL THEN
      -- Insert new candidate
      INSERT INTO public.candidates (
        candidate_name,
        location_country,
        location_state,
        location_city,
        salary_amount,
        salary_currency,
        salary_period,
        profile_summary,
        linkedin_url,
        skills,
        status,
        source,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        candidate_record.candidate_name,
        candidate_record.location_country,
        candidate_record.location_state,
        candidate_record.location_city,
        candidate_record.salary_amount,
        candidate_record.salary_currency,
        candidate_record.salary_period,
        candidate_record.profile_summary,
        candidate_record.linkedin_url,
        candidate_record.skills,
        'available',
        'job_import',
        candidate_record.added_by,
        candidate_record.created_at,
        candidate_record.updated_at
      );
      sync_count := sync_count + 1;
    ELSE
      skip_count := skip_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ CANDIDATE SYNC COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Synced: % new candidates', sync_count;
  RAISE NOTICE 'Skipped: % existing candidates', skip_count;
  RAISE NOTICE '========================================';
END $$;