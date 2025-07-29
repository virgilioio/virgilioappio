-- Complete remaining security fixes from linter review

-- Fix remaining functions that need SET search_path = ''
CREATE OR REPLACE FUNCTION public.get_organization_currency_rate(from_currency text, to_currency text, org_id uuid DEFAULT NULL::uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  org_base_currency text;
  direct_rate numeric;
  inverse_rate numeric;
  usd_to_from_rate numeric;
  usd_to_to_rate numeric;
BEGIN
  -- If same currency, return 1
  IF from_currency = to_currency THEN
    RETURN 1.0;
  END IF;
  
  -- Get organization's base currency if org_id provided
  IF org_id IS NOT NULL THEN
    org_base_currency := public.get_organization_default_currency(org_id);
  ELSE
    org_base_currency := 'USD';
  END IF;
  
  -- Try direct rate first
  SELECT rate INTO direct_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = from_currency 
    AND target_currency = to_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  IF direct_rate IS NOT NULL THEN
    RETURN direct_rate;
  END IF;
  
  -- Try inverse rate
  SELECT (1.0 / rate) INTO inverse_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = to_currency 
    AND target_currency = from_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  IF inverse_rate IS NOT NULL THEN
    RETURN inverse_rate;
  END IF;
  
  -- Try triangulation through USD if neither currency is USD
  IF from_currency != 'USD' AND to_currency != 'USD' THEN
    -- Get USD to from_currency rate
    SELECT rate INTO usd_to_from_rate
    FROM public.currency_exchange_rates
    WHERE base_currency = 'USD' AND target_currency = from_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
    
    -- Get USD to to_currency rate  
    SELECT rate INTO usd_to_to_rate
    FROM public.currency_exchange_rates
    WHERE base_currency = 'USD' AND target_currency = to_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
    
    -- Calculate cross rate: (USD/from) * (to/USD) = to/from
    IF usd_to_from_rate IS NOT NULL AND usd_to_to_rate IS NOT NULL THEN
      RETURN usd_to_to_rate / usd_to_from_rate;
    END IF;
  END IF;
  
  -- If organization has a non-USD base currency, try triangulation through org base
  IF org_base_currency != 'USD' AND org_base_currency != from_currency AND org_base_currency != to_currency THEN
    RETURN public.get_organization_currency_rate(from_currency, org_base_currency, NULL) * 
           public.get_organization_currency_rate(org_base_currency, to_currency, NULL);
  END IF;
  
  -- Fallback to 1.0
  RETURN 1.0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_organization_currencies()
RETURNS TABLE(currency_code text, organization_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    default_currency as currency_code,
    COUNT(*) as organization_count
  FROM public.organizations 
  WHERE status = 'active' 
    AND default_currency IS NOT NULL
  GROUP BY default_currency
  ORDER BY organization_count DESC, default_currency;
$function$;

CREATE OR REPLACE FUNCTION public.categorize_skills(manual_skills text[], generated_skills jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  result jsonb := '{"technical": [], "tools": [], "industries": [], "titles": [], "soft": [], "certifications": []}'::jsonb;
  skill text;
  generated_skill jsonb;
BEGIN
  -- Process manual skills (default to technical category)
  IF manual_skills IS NOT NULL THEN
    FOR skill IN SELECT unnest(manual_skills)
    LOOP
      result := jsonb_set(
        result, 
        '{technical}', 
        (result->'technical') || jsonb_build_object(
          'name', skill,
          'category', 'technical',
          'source', 'manual',
          'confidence', 1.0
        )
      );
    END LOOP;
  END IF;
  
  -- Process generated skills (keep their categories)
  IF generated_skills IS NOT NULL THEN
    FOR generated_skill IN SELECT jsonb_array_elements(generated_skills)
    LOOP
      result := jsonb_set(
        result,
        concat('{', generated_skill->>'category', '}')::text[],
        (result->(generated_skill->>'category')) || generated_skill
      );
    END LOOP;
  END IF;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_candidate_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.increment_term_usage(table_name text, term_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF table_name = 'skills' THEN
    UPDATE public.standard_skills 
    SET usage_count = usage_count + 1, last_seen = now()
    WHERE canonical_name = term_name;
  ELSIF table_name = 'job_titles' THEN
    UPDATE public.standard_job_titles 
    SET usage_count = usage_count + 1, last_seen = now()
    WHERE canonical_title = term_name;
  ELSIF table_name = 'locations' THEN
    UPDATE public.standard_locations 
    SET usage_count = usage_count + 1, last_seen = now()
    WHERE canonical_name = term_name;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_job_candidates_to_independent()
RETURNS TABLE(synced_count integer, skipped_count integer, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_salary_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.salary_market_data 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RAISE LOG 'Cleaned up % expired salary market data records', cleanup_count;
  RETURN cleanup_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_contract_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  next_number INTEGER;
  new_contract_number TEXT;
BEGIN
  -- Get the next contract number for the organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(wc.contract_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_number
  FROM worker_contracts wc
  WHERE wc.organization_id = org_id;
  
  -- Format as C0001, C0002, etc.
  new_contract_number := 'C' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_contract_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_contract_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number = generate_contract_number(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_worker_id(org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    next_id INTEGER;
BEGIN
    -- Get the next worker ID for this organization
    SELECT COALESCE(MAX(worker_id), 0) + 1 
    INTO next_id 
    FROM public.workers 
    WHERE organization_id = org_id;
    
    RETURN next_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_worker_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    -- Only assign worker_id if it's not already set
    IF NEW.worker_id IS NULL THEN
        NEW.worker_id = generate_worker_id(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_automatic_exchange_rate_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Log the start of automatic update
  INSERT INTO public.exchange_rate_update_logs (update_type, status, message)
  VALUES ('automatic', 'pending', 'Starting automatic exchange rate update');
  
  -- Make HTTP request to the edge function
  PERFORM net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/update-exchange-rates',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.manage_exchange_rate_cron(enable_cron boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  job_name TEXT := 'daily-exchange-rate-update';
BEGIN
  -- Only platform admins can manage the cron job
  IF get_user_type() != 'platform_admin' THEN
    RAISE EXCEPTION 'Only platform administrators can manage automatic exchange rate updates';
  END IF;

  IF enable_cron THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule(job_name);
    
    -- Schedule daily exchange rate update at 2:00 AM UTC
    PERFORM cron.schedule(
      job_name,
      '0 2 * * *',
      'SELECT public.execute_automatic_exchange_rate_update();'
    );
    
    RETURN 'Automatic exchange rate updates enabled. Updates will run daily at 2:00 AM UTC.';
  ELSE
    -- Disable the cron job
    PERFORM cron.unschedule(job_name);
    RETURN 'Automatic exchange rate updates disabled.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_exchange_rate_cron_status()
RETURNS TABLE(is_enabled boolean, next_run timestamp with time zone, last_automatic_update timestamp with time zone, last_update_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only users with invoice permissions can view cron status
  IF get_user_type() != 'platform_admin' AND NOT EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND m.user_status = 'active'
    AND m.member_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to view exchange rate update status';
  END IF;

  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'daily-exchange-rate-update') as is_enabled,
    CASE 
      WHEN EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'daily-exchange-rate-update') 
      THEN ((now() + interval '1 day')::date + time '02:00:00')::timestamp with time zone
      ELSE NULL 
    END as next_run,
    (SELECT created_at FROM public.exchange_rate_update_logs 
     WHERE update_type = 'automatic' 
     ORDER BY created_at DESC LIMIT 1) as last_automatic_update,
    (SELECT status FROM public.exchange_rate_update_logs 
     WHERE update_type = 'automatic' 
     ORDER BY created_at DESC LIMIT 1) as last_update_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  cleanup_count INTEGER;
BEGIN
  UPDATE public.members 
  SET 
    user_status = 'inactive',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = now()
  WHERE user_status = 'invited' 
    AND invite_expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RAISE LOG 'Cleaned up % expired invitations', cleanup_count;
  RETURN cleanup_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_invoice_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.update_invoice_payment_totals(NEW.invoice_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.update_invoice_payment_totals(OLD.invoice_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_invoice_payment_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  -- If status is 'paid', paid_at should be set
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = COALESCE(NEW.paid_at, now());
  END IF;
  
  -- If status is not 'paid', clear payment fields
  IF NEW.status != 'paid' THEN
    NEW.paid_at = NULL;
    NEW.payment_method = NULL;
    NEW.payment_reference = NULL;
    NEW.payment_notes = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS uuid
LANGUAGE sql
SET search_path = ''
AS $function$
  SELECT gen_random_uuid();
$function$;

CREATE OR REPLACE FUNCTION public.get_invite_expiry()
RETURNS timestamp with time zone
LANGUAGE sql
SET search_path = ''
AS $function$
  SELECT now() + interval '7 days';
$function$;

CREATE OR REPLACE FUNCTION public.handle_member_invite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  -- If creating a new member with invited status and no user_id, generate invite token
  IF TG_OP = 'INSERT' AND NEW.user_status = 'invited' AND NEW.user_id IS NULL THEN
    NEW.invite_token = public.generate_invite_token();
    NEW.invite_expires_at = public.get_invite_expiry();
  END IF;
  
  -- If updating status from invited to active, clear invite fields
  IF TG_OP = 'UPDATE' AND OLD.user_status = 'invited' AND NEW.user_status = 'active' THEN
    NEW.invite_token = NULL;
    NEW.invite_expires_at = NULL;
    NEW.invited_email = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_activities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_organization_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Automatically set created_by to current user
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  
  -- Set owner_assigned_at if owner_id is being set
  IF NEW.owner_id IS NOT NULL AND OLD.owner_id IS NULL THEN
    NEW.owner_assigned_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_platform_asset(new_asset_id uuid, asset_type_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Deactivate existing assets of the same type
  UPDATE public.platform_assets 
  SET is_active = false, updated_at = now()
  WHERE asset_type = asset_type_param AND is_active = true;
  
  -- Activate the new asset
  UPDATE public.platform_assets 
  SET is_active = true, updated_at = now()
  WHERE id = new_asset_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_recursion_safety()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $function$
BEGIN
  -- This is a simple check that can be used in policies if needed
  -- It doesn't query any tables that have RLS policies
  RETURN auth.uid() IS NOT NULL;
END;
$function$;