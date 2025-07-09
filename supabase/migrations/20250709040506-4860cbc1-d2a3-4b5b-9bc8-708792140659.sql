-- Create function to sync job candidates to independent candidates table
CREATE OR REPLACE FUNCTION public.sync_job_candidates_to_independent()
RETURNS TABLE(
  synced_count integer,
  skipped_count integer,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sync_count integer := 0;
  skip_count integer := 0;
  candidate_record RECORD;
  existing_candidate_id uuid;
  sync_details jsonb := '[]'::jsonb;
BEGIN
  -- Only allow platform admins to run this function
  IF get_user_type_secure() != 'platform_admin' THEN
    RAISE EXCEPTION 'Only platform administrators can sync candidates';
  END IF;

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
    FROM job_candidates
    ORDER BY candidate_name, COALESCE(location_country, ''), COALESCE(location_city, ''), created_at ASC
  LOOP
    -- Check if candidate already exists in independent candidates table
    SELECT id INTO existing_candidate_id
    FROM candidates
    WHERE candidate_name = candidate_record.candidate_name
      AND COALESCE(location_country, '') = COALESCE(candidate_record.location_country, '')
      AND COALESCE(location_city, '') = COALESCE(candidate_record.location_city, '');

    IF existing_candidate_id IS NULL THEN
      -- Insert new candidate into independent candidates table
      INSERT INTO candidates (
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
      
      -- Add to details
      sync_details := sync_details || jsonb_build_object(
        'action', 'synced',
        'candidate_name', candidate_record.candidate_name,
        'location', COALESCE(candidate_record.location_city || ', ', '') || COALESCE(candidate_record.location_country, 'Unknown')
      );
    ELSE
      skip_count := skip_count + 1;
      
      -- Add to details
      sync_details := sync_details || jsonb_build_object(
        'action', 'skipped',
        'candidate_name', candidate_record.candidate_name,
        'location', COALESCE(candidate_record.location_city || ', ', '') || COALESCE(candidate_record.location_country, 'Unknown'),
        'reason', 'already_exists'
      );
    END IF;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT sync_count, skip_count, sync_details;
END;
$$;

-- Create a simple wrapper function for easy execution
CREATE OR REPLACE FUNCTION public.execute_candidate_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result RECORD;
BEGIN
  -- Only allow platform admins to run this function
  IF get_user_type_secure() != 'platform_admin' THEN
    RAISE EXCEPTION 'Only platform administrators can sync candidates';
  END IF;

  SELECT * INTO result FROM public.sync_job_candidates_to_independent();
  
  RAISE NOTICE 'Candidate sync completed: % synced, % skipped', result.synced_count, result.skipped_count;
END;
$$;