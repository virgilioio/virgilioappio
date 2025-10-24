# Sourcing Tables Read-Only Migration Report

**Date**: 2025-10-24  
**Phase**: Sourcing Removal - Database Read-Only Protection  
**Status**: ✅ COMPLETE

---

## Executive Summary

Successfully migrated three sourcing-related tables (`org_credit_usage`, `external_candidate_matches`, `sourcing_events`) to read-only mode. All INSERT, UPDATE, and DELETE policies have been removed while preserving SELECT policies for platform admins and organization members. Data remains visible for inspection but cannot be modified.

---

## 1. Migration SQL Executed

### Full Migration Script

```sql
-- Phase 2: Make Sourcing Tables Read-Only (Temporary)
-- Remove INSERT/UPDATE/DELETE policies, keep SELECT for inspection

-- ========================================
-- 1. org_credit_usage: Make Read-Only
-- ========================================

-- Drop existing policies that allow writes
DROP POLICY IF EXISTS "Platform admins can manage org credits" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Platform admins can refill credits" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Org members can update credits" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Service can update credits" ON public.org_credit_usage;

-- Keep/Create read-only policy for platform admins
DROP POLICY IF EXISTS "Platform admins can view org credits - READ ONLY" ON public.org_credit_usage;
CREATE POLICY "Platform admins can view org credits - READ ONLY"
  ON public.org_credit_usage
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

-- Keep/Create read-only policy for org members
DROP POLICY IF EXISTS "Org members can view their org credits - READ ONLY" ON public.org_credit_usage;
CREATE POLICY "Org members can view their org credits - READ ONLY"
  ON public.org_credit_usage
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- ========================================
-- 2. external_candidate_matches: Make Read-Only
-- ========================================

-- Drop existing write policies
DROP POLICY IF EXISTS "Platform admins can manage all external matches" ON public.external_candidate_matches;
DROP POLICY IF EXISTS "Org recruiters can create external matches" ON public.external_candidate_matches;
DROP POLICY IF EXISTS "Org members can update external matches" ON public.external_candidate_matches;

-- Keep existing SELECT policy (already exists in schema)
-- "Org members can view their org external matches" - already in place

-- Ensure platform admins can still view
DROP POLICY IF EXISTS "Platform admins can view external matches - READ ONLY" ON public.external_candidate_matches;
CREATE POLICY "Platform admins can view external matches - READ ONLY"
  ON public.external_candidate_matches
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

-- ========================================
-- 3. sourcing_events: Make Read-Only
-- ========================================

-- Drop existing write policies
DROP POLICY IF EXISTS "Platform admins can manage sourcing events" ON public.sourcing_events;
DROP POLICY IF EXISTS "Service can insert sourcing events" ON public.sourcing_events;
DROP POLICY IF EXISTS "Edge functions can insert sourcing events" ON public.sourcing_events;

-- Create read-only policy for platform admins
DROP POLICY IF EXISTS "Platform admins can view sourcing events - READ ONLY" ON public.sourcing_events;
CREATE POLICY "Platform admins can view sourcing events - READ ONLY"
  ON public.sourcing_events
  FOR SELECT
  USING (get_user_type_secure() = 'platform_admin');

-- Create read-only policy for org members
DROP POLICY IF EXISTS "Org members can view their sourcing events - READ ONLY" ON public.sourcing_events;
CREATE POLICY "Org members can view their sourcing events - READ ONLY"
  ON public.sourcing_events
  FOR SELECT
  USING (check_org_member_access(organization_id));

-- ========================================
-- Verification Queries
-- ========================================

-- Add comments for documentation
COMMENT ON TABLE public.org_credit_usage IS 'READ-ONLY: Sourcing credits table - writes disabled during cleanup';
COMMENT ON TABLE public.external_candidate_matches IS 'READ-ONLY: External candidate matches - writes disabled during cleanup';
COMMENT ON TABLE public.sourcing_events IS 'READ-ONLY: Sourcing events log - writes disabled during cleanup';
```

**Status**: ✅ Migration executed successfully

---

## 2. Current RLS Policies After Migration

### org_credit_usage

**Table Status**: 🔒 READ-ONLY

| Policy Name | Command | Expression | Status |
|-------------|---------|------------|--------|
| Platform admins can view org credits - READ ONLY | SELECT | `get_user_type_secure() = 'platform_admin'` | ✅ ACTIVE |
| Org members can view their org credits - READ ONLY | SELECT | `check_org_member_access(organization_id)` | ✅ ACTIVE |

**Blocked Operations**:
- ❌ INSERT (no policies)
- ❌ UPDATE (no policies)
- ❌ DELETE (no policies)

**Allowed Operations**:
- ✅ SELECT (platform admins + org members)

---

### external_candidate_matches

**Table Status**: 🔒 READ-ONLY

| Policy Name | Command | Expression | Status |
|-------------|---------|------------|--------|
| Org members can view their org external matches | SELECT | `check_org_member_access(organization_id)` | ✅ ACTIVE (existing) |
| Platform admins can view external matches - READ ONLY | SELECT | `get_user_type_secure() = 'platform_admin'` | ✅ ACTIVE (new) |

**Blocked Operations**:
- ❌ INSERT (no policies)
- ❌ UPDATE (no policies)
- ❌ DELETE (no policies)

**Allowed Operations**:
- ✅ SELECT (platform admins + org members)

---

### sourcing_events

**Table Status**: 🔒 READ-ONLY

| Policy Name | Command | Expression | Status |
|-------------|---------|------------|--------|
| Platform admins can view sourcing events - READ ONLY | SELECT | `get_user_type_secure() = 'platform_admin'` | ✅ ACTIVE |
| Org members can view their sourcing events - READ ONLY | SELECT | `check_org_member_access(organization_id)` | ✅ ACTIVE |

**Blocked Operations**:
- ❌ INSERT (no policies)
- ❌ UPDATE (no policies)
- ❌ DELETE (no policies)

**Allowed Operations**:
- ✅ SELECT (platform admins + org members)

---

## 3. Application Impact Analysis

### Code References to Sourcing Tables

**Search Results**: (from previous cleanup phases)

| File | Reference | Impact |
|------|-----------|--------|
| ✅ All sourcing components | DELETED | No code writes to these tables |
| ✅ All sourcing hooks | DELETED | No code reads/writes to these tables |
| ✅ sourcing-search edge function | DELETED | No edge function writes to these tables |
| ✅ Stripe webhook credit refill | REMOVED | No webhook writes to org_credit_usage |

**Conclusion**: No application code attempts to write to these tables.

---

## 4. Verification Queries

### Pre-Migration Baseline

Run these queries to establish baseline counts:

```sql
-- Get current row counts
SELECT 
  'org_credit_usage' as table_name,
  COUNT(*) as row_count,
  MAX(updated_at) as last_updated
FROM public.org_credit_usage
UNION ALL
SELECT 
  'external_candidate_matches',
  COUNT(*),
  MAX(updated_at)
FROM public.external_candidate_matches
UNION ALL
SELECT 
  'sourcing_events',
  COUNT(*),
  MAX(created_at)
FROM public.sourcing_events;
```

**Expected Output** (example):
```
┌──────────────────────────────┬───────────┬─────────────────────────┐
│ table_name                   │ row_count │ last_updated            │
├──────────────────────────────┼───────────┼─────────────────────────┤
│ org_credit_usage             │ 5         │ 2025-10-20 14:23:12     │
│ external_candidate_matches   │ 142       │ 2025-10-19 09:15:33     │
│ sourcing_events              │ 87        │ 2025-10-18 16:47:22     │
└──────────────────────────────┴───────────┴─────────────────────────┘
```

### Post-Migration Monitoring

**24-Hour Verification** - Run after migration:

```sql
-- Check for new writes (should be 0)
SELECT 
  'org_credit_usage' as table_name,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') as new_updates,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_inserts
FROM public.org_credit_usage
UNION ALL
SELECT 
  'external_candidate_matches',
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours'),
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')
FROM public.external_candidate_matches
UNION ALL
SELECT 
  'sourcing_events',
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')
FROM public.sourcing_events;
```

**Expected Output**:
```
┌──────────────────────────────┬─────────────┬──────────────┐
│ table_name                   │ new_updates │ new_inserts  │
├──────────────────────────────┼─────────────┼──────────────┤
│ org_credit_usage             │ 0           │ 0            │
│ external_candidate_matches   │ 0           │ 0            │
│ sourcing_events              │ 0           │ 0            │
└──────────────────────────────┴─────────────┴──────────────┘
```

✅ **All zeros = no writes occurred**

### Inspect Existing Data

**View org_credit_usage**:
```sql
SELECT 
  organization_id,
  search_limit,
  search_remaining,
  collect_limit,
  collect_remaining,
  last_refill_at,
  next_refill_at
FROM public.org_credit_usage
ORDER BY last_refill_at DESC NULLS LAST;
```

**View external_candidate_matches**:
```sql
SELECT 
  organization_id,
  job_id,
  candidate_name,
  provider,
  match_score,
  is_collected,
  created_at
FROM public.external_candidate_matches
ORDER BY created_at DESC
LIMIT 20;
```

**View sourcing_events**:
```sql
SELECT 
  organization_id,
  job_id,
  event_type,
  credits_used,
  results_count,
  cache_hit,
  created_at
FROM public.sourcing_events
ORDER BY created_at DESC
LIMIT 20;
```

---

## 5. Write Attempt Test

### Test INSERT Protection

Attempt to insert a row (should fail):

```sql
-- This should fail with RLS policy error
INSERT INTO public.org_credit_usage (
  organization_id,
  search_limit,
  search_remaining,
  collect_limit,
  collect_remaining
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  100,
  100,
  50,
  50
);
```

**Expected Error**:
```
ERROR: new row violates row-level security policy for table "org_credit_usage"
```

### Test UPDATE Protection

Attempt to update a row (should fail):

```sql
-- This should fail with RLS policy error
UPDATE public.org_credit_usage
SET search_remaining = 999
WHERE organization_id = (
  SELECT organization_id FROM public.org_credit_usage LIMIT 1
);
```

**Expected Error**:
```
ERROR: new row violates row-level security policy for table "org_credit_usage"
```

### Test DELETE Protection

Attempt to delete a row (should fail):

```sql
-- This should fail with RLS policy error
DELETE FROM public.external_candidate_matches
WHERE id = (
  SELECT id FROM public.external_candidate_matches LIMIT 1
);
```

**Expected Error**:
```
ERROR: new row violates row-level security policy for table "external_candidate_matches"
```

### Test SELECT Access

Verify read access still works:

```sql
-- This should succeed (as platform admin or org member)
SELECT COUNT(*) FROM public.org_credit_usage;
SELECT COUNT(*) FROM public.external_candidate_matches;
SELECT COUNT(*) FROM public.sourcing_events;
```

**Expected**: Returns counts successfully ✅

---

## 6. Table Documentation

### Table Comments

After migration, tables now have documentation comments:

```sql
-- View table comments
SELECT 
  tablename,
  obj_description(
    (schemaname || '.' || tablename)::regclass,
    'pg_class'
  ) as description
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'org_credit_usage',
    'external_candidate_matches',
    'sourcing_events'
  );
```

**Expected Output**:
```
┌──────────────────────────────┬──────────────────────────────────────────────────────┐
│ tablename                    │ description                                          │
├──────────────────────────────┼──────────────────────────────────────────────────────┤
│ org_credit_usage             │ READ-ONLY: Sourcing credits table - writes disabled │
│ external_candidate_matches   │ READ-ONLY: External candidate matches - writes...   │
│ sourcing_events              │ READ-ONLY: Sourcing events log - writes disabled... │
└──────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

## 7. Data Inspection Window

### Current Data Summary

**org_credit_usage**:
```sql
SELECT 
  COUNT(*) as total_orgs,
  SUM(search_remaining) as total_search_credits,
  SUM(collect_remaining) as total_collect_credits,
  COUNT(*) FILTER (WHERE search_remaining > 0) as orgs_with_search_credits,
  COUNT(*) FILTER (WHERE collect_remaining > 0) as orgs_with_collect_credits
FROM public.org_credit_usage;
```

**external_candidate_matches**:
```sql
SELECT 
  COUNT(*) as total_matches,
  COUNT(DISTINCT organization_id) as unique_orgs,
  COUNT(DISTINCT job_id) as unique_jobs,
  COUNT(*) FILTER (WHERE is_collected = true) as collected_candidates,
  COUNT(*) FILTER (WHERE match_score >= 80) as high_quality_matches,
  AVG(match_score) as avg_match_score
FROM public.external_candidate_matches;
```

**sourcing_events**:
```sql
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT organization_id) as unique_orgs,
  SUM(credits_used) as total_credits_consumed,
  SUM(results_count) as total_results_returned,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  COUNT(*) FILTER (WHERE cache_hit = false) as cache_misses
FROM public.sourcing_events;
```

### Export Data (Optional)

If you need to export data before eventual deletion:

```sql
-- Export org_credit_usage
COPY (
  SELECT * FROM public.org_credit_usage
) TO '/tmp/org_credit_usage_backup.csv' CSV HEADER;

-- Export external_candidate_matches
COPY (
  SELECT * FROM public.external_candidate_matches
) TO '/tmp/external_candidate_matches_backup.csv' CSV HEADER;

-- Export sourcing_events
COPY (
  SELECT * FROM public.sourcing_events
) TO '/tmp/sourcing_events_backup.csv' CSV HEADER;
```

**Alternative** (via Supabase SQL Editor):
```sql
-- Run and download as CSV from Supabase dashboard
SELECT * FROM public.org_credit_usage;
SELECT * FROM public.external_candidate_matches;
SELECT * FROM public.sourcing_events;
```

---

## 8. Security Linter Warnings

The migration triggered 6 security warnings (unrelated to this change):

### Pre-Existing Warnings (Not Migration-Related)

1. **Function Search Path Mutable** (4 warnings)
   - Some database functions don't have `search_path` set
   - **Impact**: Low (existing issue, not introduced by migration)
   - **Action**: Can be addressed in future cleanup

2. **Extension in Public** (1 warning)
   - Extensions installed in `public` schema
   - **Impact**: Low (existing configuration)
   - **Action**: Can be addressed in future cleanup

3. **Postgres Version** (1 warning)
   - Security patches available for Postgres version
   - **Impact**: Low (infrastructure upgrade needed)
   - **Action**: Upgrade Postgres instance when convenient

**Migration-Related Issues**: ✅ NONE

The migration itself introduced no new security issues. All warnings are pre-existing.

---

## 9. Rollback Plan

If you need to restore write access to these tables:

### Rollback SQL

```sql
-- ========================================
-- ROLLBACK: Restore Write Access
-- ========================================

-- 1. org_credit_usage: Restore write access
DROP POLICY IF EXISTS "Platform admins can view org credits - READ ONLY" ON public.org_credit_usage;
DROP POLICY IF EXISTS "Org members can view their org credits - READ ONLY" ON public.org_credit_usage;

CREATE POLICY "Platform admins can manage org credits"
  ON public.org_credit_usage
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- 2. external_candidate_matches: Restore write access
DROP POLICY IF EXISTS "Platform admins can view external matches - READ ONLY" ON public.external_candidate_matches;

CREATE POLICY "Platform admins can manage all external matches"
  ON public.external_candidate_matches
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- 3. sourcing_events: Restore write access
DROP POLICY IF EXISTS "Platform admins can view sourcing events - READ ONLY" ON public.sourcing_events;
DROP POLICY IF EXISTS "Org members can view their sourcing events - READ ONLY" ON public.sourcing_events;

CREATE POLICY "Platform admins can manage sourcing events"
  ON public.sourcing_events
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Remove READ-ONLY comments
COMMENT ON TABLE public.org_credit_usage IS NULL;
COMMENT ON TABLE public.external_candidate_matches IS NULL;
COMMENT ON TABLE public.sourcing_events IS NULL;
```

**Note**: Rollback should NOT be necessary as sourcing functionality has been completely removed.

---

## 10. Next Steps

### Immediate Monitoring (24-48 hours)

1. ✅ Run verification queries daily
2. ✅ Confirm zero new writes to sourcing tables
3. ✅ Monitor application logs for RLS policy errors
4. ✅ Check Supabase logs for failed INSERT/UPDATE attempts

### Inspection Window (1-2 weeks)

- Review data in sourcing tables
- Export data if needed for historical analysis
- Confirm no business need for sourcing data

### Future Cleanup (Optional)

Once confirmed no longer needed:

```sql
-- WARNING: DESTRUCTIVE - only run after thorough review
DROP TABLE IF EXISTS public.sourcing_events CASCADE;
DROP TABLE IF EXISTS public.external_candidate_matches CASCADE;
DROP TABLE IF EXISTS public.org_credit_usage CASCADE;

-- Also drop related functions
DROP FUNCTION IF EXISTS public.refill_org_sourcing_credits(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.consume_sourcing_credits(uuid, text, integer);
DROP FUNCTION IF EXISTS public.get_org_credits(uuid);
```

---

## 11. Monitoring Checklist

### Daily Checks (First Week)

- [ ] Run row count verification query
- [ ] Check for new writes (should be 0)
- [ ] Review application logs for RLS errors
- [ ] Verify SELECT access still works

### Weekly Checks (Weeks 2-4)

- [ ] Confirm data remains stable (no new rows)
- [ ] Review any business requests for sourcing data
- [ ] Plan for eventual table removal

### Success Criteria

✅ Zero new rows inserted after migration  
✅ Zero updates to existing rows  
✅ SELECT queries work for authorized users  
✅ No application errors related to sourcing tables  
✅ No business impact from read-only status  

---

## 12. Summary

### Changes Applied

✅ **org_credit_usage**: Read-only (SELECT for admins + org members)  
✅ **external_candidate_matches**: Read-only (SELECT for admins + org members)  
✅ **sourcing_events**: Read-only (SELECT for admins + org members)  

### Policies Removed

❌ All INSERT policies  
❌ All UPDATE policies  
❌ All DELETE policies  

### Policies Preserved/Created

✅ Platform admin SELECT policies  
✅ Organization member SELECT policies  

### Application Impact

✅ **Zero impact** - no code writes to these tables  
✅ **Data preserved** - all existing data intact and viewable  
✅ **Protection enabled** - accidental writes prevented  

### Verification Status

✅ Migration executed successfully  
✅ RLS policies updated correctly  
✅ Table comments added  
✅ Ready for monitoring  

---

## 13. Verification Commands Summary

### Quick Verification

```bash
# Connect to Supabase via psql or SQL Editor
# Run this single query to verify read-only status:

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'org_credit_usage',
    'external_candidate_matches',
    'sourcing_events'
  )
ORDER BY tablename, cmd;

-- Expected: Only SELECT policies, no INSERT/UPDATE/DELETE
```

### Test Write Protection

```sql
-- All three queries should fail with RLS error:
INSERT INTO public.org_credit_usage (organization_id, search_limit, search_remaining, collect_limit, collect_remaining) VALUES ('00000000-0000-0000-0000-000000000000', 0, 0, 0, 0);
INSERT INTO public.external_candidate_matches (organization_id, candidate_name, provider_id, provider) VALUES ('00000000-0000-0000-0000-000000000000', 'Test', 'test', 'test');
INSERT INTO public.sourcing_events (organization_id, event_type) VALUES ('00000000-0000-0000-0000-000000000000', 'test');

-- Expected: "new row violates row-level security policy" error for all three
```

### Monitor Changes

```sql
-- Run daily for 7 days to confirm zero new activity:
SELECT 
  NOW() as checked_at,
  (SELECT COUNT(*) FROM public.org_credit_usage) as org_credit_rows,
  (SELECT COUNT(*) FROM public.external_candidate_matches) as external_match_rows,
  (SELECT COUNT(*) FROM public.sourcing_events) as sourcing_event_rows;

-- Compare results - counts should remain constant
```

---

**Status**: ✅ MIGRATION COMPLETE - Tables are read-only  
**Next Action**: Monitor for 24-48 hours, then proceed with further cleanup if needed  

---

**End of Report**
