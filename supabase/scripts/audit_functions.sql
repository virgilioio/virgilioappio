-- Audit Script: Security Definer Functions Missing Search Path
-- Purpose: Identify all SECURITY DEFINER functions that lack explicit search_path configuration
-- This is a security best practice to prevent search_path hijacking attacks
-- 
-- Usage: Run this in Supabase SQL Editor or via psql
-- Output: List of functions that need to be patched

SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS function_args,
  p.prosecdef AS is_security_definer,
  p.proconfig AS current_config,
  CASE 
    WHEN p.proconfig IS NULL THEN 'NO CONFIG'
    WHEN NOT EXISTS (
      SELECT 1 
      FROM unnest(p.proconfig) cfg 
      WHERE cfg LIKE 'search_path=%'
    ) THEN 'MISSING search_path'
    ELSE 'HAS search_path'
  END AS search_path_status,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE 
  p.prosecdef = true  -- Only SECURITY DEFINER functions
  AND n.nspname = 'public'  -- Focus on public schema
  AND (
    p.proconfig IS NULL 
    OR NOT EXISTS (
      SELECT 1 
      FROM unnest(p.proconfig) cfg 
      WHERE cfg LIKE 'search_path=%'
    )
  )
ORDER BY p.proname;

-- Additional check: List all SECURITY DEFINER functions with their search_path settings
-- (for reference and verification)
-- 
-- SELECT 
--   n.nspname AS schema_name,
--   p.proname AS function_name,
--   p.prosecdef AS is_security_definer,
--   COALESCE(
--     (SELECT cfg FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),
--     'NOT SET'
--   ) AS search_path_setting
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.prosecdef = true AND n.nspname = 'public'
-- ORDER BY p.proname;
