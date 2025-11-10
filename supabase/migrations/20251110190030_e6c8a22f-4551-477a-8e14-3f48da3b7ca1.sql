-- MVP Phase 5: Email Security - Suppression List & Rate Limiting

-- ==============================================================================
-- PART 1: Email Suppression List
-- ==============================================================================

-- Create email suppression list table
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  suppressed_at timestamptz DEFAULT now(),
  suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add index for fast email lookups
CREATE INDEX idx_email_suppression_list_email ON email_suppression_list(email);
CREATE INDEX idx_email_suppression_list_tenant ON email_suppression_list(tenant_id);

-- Enable RLS on email_suppression_list
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_suppression_list
CREATE POLICY "Tenant members can view suppression list"
ON email_suppression_list
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM members WHERE user_id = auth.uid() AND user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Workspace owners can insert to suppression list"
ON email_suppression_list
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = email_suppression_list.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Workspace owners can delete from suppression list"
ON email_suppression_list
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = email_suppression_list.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

-- Function to check if an email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM email_suppression_list WHERE LOWER(email) = LOWER(p_email)
  );
$$;

-- ==============================================================================
-- PART 2: Email Rate Limiting
-- ==============================================================================

-- Create email rate limits table (one record per tenant)
CREATE TABLE IF NOT EXISTS email_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  hourly_limit integer NOT NULL DEFAULT 50,
  daily_limit integer NOT NULL DEFAULT 500,
  hourly_count integer NOT NULL DEFAULT 0,
  daily_count integer NOT NULL DEFAULT 0,
  hour_resets_at timestamptz NOT NULL DEFAULT (date_trunc('hour', now()) + INTERVAL '1 hour'),
  day_resets_at timestamptz NOT NULL DEFAULT (date_trunc('day', now()) + INTERVAL '1 day'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for fast tenant lookups
CREATE INDEX idx_email_rate_limits_tenant ON email_rate_limits(tenant_id);

-- Enable RLS on email_rate_limits
ALTER TABLE email_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_rate_limits
CREATE POLICY "Tenant members can view rate limits"
ON email_rate_limits
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM members WHERE user_id = auth.uid() AND user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Workspace owners can update rate limits"
ON email_rate_limits
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = email_rate_limits.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

-- Function to check and increment email rate limit
CREATE OR REPLACE FUNCTION check_email_rate_limit(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limit_record email_rate_limits%ROWTYPE;
  result jsonb;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO limit_record FROM email_rate_limits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If no record exists, create one with defaults
  IF NOT FOUND THEN
    INSERT INTO email_rate_limits (tenant_id)
    VALUES (p_tenant_id)
    RETURNING * INTO limit_record;
  END IF;
  
  -- Reset hourly counter if expired
  IF limit_record.hour_resets_at < now() THEN
    UPDATE email_rate_limits SET 
      hourly_count = 0,
      hour_resets_at = date_trunc('hour', now()) + INTERVAL '1 hour',
      updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO limit_record;
  END IF;
  
  -- Reset daily counter if expired
  IF limit_record.day_resets_at < now() THEN
    UPDATE email_rate_limits SET 
      daily_count = 0,
      day_resets_at = date_trunc('day', now()) + INTERVAL '1 day',
      updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO limit_record;
  END IF;
  
  -- Check if limits are exceeded
  IF limit_record.hourly_count >= limit_record.hourly_limit THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit_exceeded',
      'retry_after', EXTRACT(EPOCH FROM (limit_record.hour_resets_at - now()))::integer,
      'hourly_remaining', 0,
      'daily_remaining', limit_record.daily_limit - limit_record.daily_count
    );
    RETURN result;
  END IF;
  
  IF limit_record.daily_count >= limit_record.daily_limit THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'retry_after', EXTRACT(EPOCH FROM (limit_record.day_resets_at - now()))::integer,
      'hourly_remaining', limit_record.hourly_limit - limit_record.hourly_count,
      'daily_remaining', 0
    );
    RETURN result;
  END IF;
  
  -- Increment counters
  UPDATE email_rate_limits SET
    hourly_count = hourly_count + 1,
    daily_count = daily_count + 1,
    updated_at = now()
  WHERE tenant_id = p_tenant_id
  RETURNING * INTO limit_record;
  
  -- Return success with remaining counts
  result := jsonb_build_object(
    'allowed', true,
    'hourly_remaining', limit_record.hourly_limit - limit_record.hourly_count,
    'daily_remaining', limit_record.daily_limit - limit_record.daily_count
  );
  
  RETURN result;
END;
$$;