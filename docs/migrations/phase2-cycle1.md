# Phase 2 Cycle 1: Complete Candidate Data Model Migration

## Objective
Migrate fully from legacy `job_candidates` table to modern `candidates` + `job_candidate_associations` tables. Eliminate data duplication and metrics drift.

## Pre-Flight Audit: Parity Checks

Run these SQL queries **before** and **after** the sync to verify data parity:

### 1. Per-Organization Candidate Counts

```sql
-- Association-based count (modern model)
SELECT 
  j.organization_id,
  COUNT(DISTINCT jca.candidate_id) AS assoc_candidate_count,
  COUNT(*) AS total_associations
FROM job_candidate_associations jca
JOIN jobs j ON j.id = jca.job_id
GROUP BY j.organization_id
ORDER BY j.organization_id;

-- Legacy table count
SELECT 
  j.organization_id,
  COUNT(DISTINCT jc.id) AS legacy_candidate_count
FROM job_candidates jc
JOIN jobs j ON j.id = jc.job_id
GROUP BY j.organization_id
ORDER BY j.organization_id;
```

**Expected**: Counts should match after sync.

### 2. Per-Job Candidate Counts

```sql
-- Association-based count per job
SELECT 
  job_id,
  COUNT(*) AS assoc_count
FROM job_candidate_associations
GROUP BY job_id
ORDER BY job_id;

-- Legacy count per job
SELECT 
  job_id,
  COUNT(*) AS legacy_count
FROM job_candidates
GROUP BY job_id
ORDER BY job_id;
```

**Expected**: All jobs should have matching counts.

### 3. Recent Activity (30-day window for metrics)

```sql
-- Candidates added via associations (last 30 days)
SELECT 
  j.organization_id,
  COUNT(DISTINCT jca.candidate_id) AS recent_candidates_assoc
FROM job_candidate_associations jca
JOIN jobs j ON j.id = jca.job_id
WHERE jca.created_at >= NOW() - INTERVAL '30 days'
GROUP BY j.organization_id
ORDER BY j.organization_id;

-- Legacy recent candidates (last 30 days)
SELECT 
  j.organization_id,
  COUNT(DISTINCT jc.id) AS recent_candidates_legacy
FROM job_candidates jc
JOIN jobs j ON j.id = jc.job_id
WHERE jc.created_at >= NOW() - INTERVAL '30 days'
GROUP BY j.organization_id
ORDER BY j.organization_id;
```

**Expected**: Metrics drift should be minimal; sync will resolve discrepancies.

### 4. Total Counts (Sanity Check)

```sql
-- Total independent candidates
SELECT COUNT(*) AS total_independent_candidates FROM candidates;

-- Total legacy candidates
SELECT COUNT(*) AS total_legacy_candidates FROM job_candidates;

-- Total associations
SELECT COUNT(*) AS total_associations FROM job_candidate_associations;
```

## Data Sync Steps

### Option A: Using Existing RPC Function

The database already has `sync_job_candidates_to_independent()` RPC function.

**To execute manually via SQL Editor**:

```sql
-- Must be run as platform_admin
SELECT * FROM sync_job_candidates_to_independent();
```

**Expected Output**:
```
synced_count | skipped_count | details
-------------|---------------|--------
     142     |      58       | [...JSON array with per-candidate sync results...]
```

### Option B: CLI Script (for dev environment)

Create `scripts/run_sync_candidates.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://etrxjxstjfcozdjumfsj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // From .env

async function runSync() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('🔄 Starting candidate sync...')
  
  const { data, error } = await supabase.rpc('sync_job_candidates_to_independent')
  
  if (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  }
  
  console.log('✅ Sync completed:')
  console.log(`  - Synced: ${data[0].synced_count}`)
  console.log(`  - Skipped: ${data[0].skipped_count}`)
  console.log('\n📊 Re-run parity checks from docs/migrations/phase2-cycle1.md')
}

runSync()
```

**Run**:
```bash
npx tsx scripts/run_sync_candidates.ts
```

### Idempotency

The sync function is **idempotent**:
- Checks for existing `candidates` by `candidate_name + location`
- Only inserts if no match found
- Safe to run multiple times

## Code Changes

### Files Updated

1. **src/hooks/useSaaSCustomers.ts** (line 66-68)
   - Changed: `job_candidates` → `job_candidate_associations` for 30-day metrics
   - Counts distinct `candidate_id` values created in last 30 days

2. **src/hooks/useSaaSCustomer.ts** (line 63-66)
   - Changed: Same as above, scoped to single organization

3. **src/hooks/useCandidateResolver.ts** (lines 45-49)
   - **Removed**: Fallback to `job_candidates` table
   - Now only resolves via `candidates` table directly

4. **src/integrations/supabase/types.ts**
   - Will be regenerated after `job_candidates` drop (see Migration SQL below)

### Metrics Guidance

**"Candidates added (30d)"** now means:
- Count of **distinct `candidate_id`** in `job_candidate_associations` where `created_at >= NOW() - INTERVAL '30 days'`
- Reflects when candidates were **associated to jobs**, not when the global candidate record was created

**"Jobs created (30d)"**:
- Unchanged, uses `jobs.created_at`

**"Active members (30d)"**:
- Unchanged, uses existing membership activity logic

## Lock & Drop Legacy Table

### Step 1: Freeze Writes (Safety Lock)

After code is merged and parity is confirmed:

```sql
-- Enable RLS on legacy table
ALTER TABLE job_candidates ENABLE ROW LEVEL SECURITY;

-- Block all writes (reads still allowed for verification)
CREATE POLICY job_candidates_readonly
  ON job_candidates
  FOR ALL
  USING (true)
  WITH CHECK (false);
```

**Test**: Attempt to `INSERT` or `UPDATE` `job_candidates` → should fail with RLS error.

### Step 2: Final Parity Check

Re-run all SQL queries from "Pre-Flight Audit" section. Verify:
- ✅ No deltas between association counts and legacy counts
- ✅ 30-day metrics match expected ranges
- ✅ No orphaned records

### Step 3: Drop Legacy Table

```sql
-- Remove RLS policies first
DROP POLICY IF EXISTS job_candidates_readonly ON job_candidates;

-- Drop the table (CASCADE removes foreign keys, triggers, etc.)
DROP TABLE IF EXISTS job_candidates CASCADE;
```

### Step 4: Regenerate Types

```bash
# Local development
npx supabase gen types typescript --local > src/integrations/supabase/types.ts

# Production (if using Supabase CLI with project linked)
npx supabase gen types typescript --project-id etrxjxstjfcozdjumfsj > src/integrations/supabase/types.ts
```

**Commit** the updated `types.ts` file.

## Verification Checklist

### Manual Tests

- [ ] **Pipeline Kanban**
  - Drag & drop candidates across stages
  - Verify writes only hit `job_candidate_associations` (check Network tab)
  - No errors in console

- [ ] **SaaS Admin Metrics** (`/settings/platform/saas-customers`)
  - Customer list loads
  - 30-day candidate counts display correctly
  - Detail view shows accurate usage

- [ ] **SaaS Owner Metrics** (`/settings?tab=subscription`)
  - Usage stats load
  - No errors about missing `job_candidates` table

- [ ] **Candidate Creation**
  - Create new candidate via "Add Candidate" form
  - Associate to a job
  - Move through pipeline stages
  - Verify all operations succeed

### Automated Checks

- [ ] **Parity SQL**: All count queries return 0 delta
- [ ] **Types**: No TypeScript errors related to `job_candidates`
- [ ] **RLS**: No policy violations in console
- [ ] **Error Toasts**: Real messages (via `extractErrorMessage`)
- [ ] **Logger**: No raw `console.*` calls (use `log.*`)

## Rollback Plan (Emergency)

If critical issues arise **before** the drop:

1. **Revert code changes**: `git revert <commit-hash>`
2. **Remove RLS lock**: `DROP POLICY job_candidates_readonly ON job_candidates;`
3. **Investigate**: Check logs, run parity queries, identify delta source

If issues arise **after** the drop:
- Data is preserved in `candidates` + `job_candidate_associations`
- Recreate `job_candidates` view if needed (not recommended; fix forward instead)

## Success Criteria

- ✅ All code uses `candidates` + `job_candidate_associations`
- ✅ `job_candidates` table dropped
- ✅ Supabase types regenerated and committed
- ✅ SaaS metrics (admin + owner) display correctly
- ✅ Pipeline fully functional (drag/drop, stage transitions)
- ✅ No RLS violations or TypeScript errors
- ✅ Error handling consistent (logger + extractErrorMessage)

## Timeline

- **Pre-Sync Audit**: 10 min (run SQL queries, document counts)
- **Data Sync**: 5 min (execute RPC, verify output)
- **Code Updates**: 30 min (update hooks, test locally)
- **Post-Sync Parity Check**: 10 min (re-run SQL queries)
- **Lock & Drop**: 5 min (RLS lock → final checks → DROP)
- **Types Regeneration**: 5 min (supabase gen types + commit)
- **Manual Testing**: 30 min (pipeline, metrics, candidate CRUD)

**Total**: ~1.5 hours (single developer, sequential execution)

## Out of Scope (Future Cycles)

- Stripe/billing portal integration
- Trial management UI
- React Query migration for hooks
- New metrics/analytics beyond parity
