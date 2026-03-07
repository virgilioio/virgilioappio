

# Fix: Batch Enrichment Infinite Loop

## Root Cause

When a candidate is **skipped** (no resume, text too short, unreadable PDF) or **fails** (download error), the batch function never updates their `enrichment_status`. They remain `'pending'` and get picked up again on the next batch call — creating an infinite loop.

## Fix

**File**: `supabase/functions/batch-re-enrich/index.ts`

For every skip/fail path in the processing loop, update the candidate's `enrichment_status` in the database:

- **Skipped** (no file URL, text too short, unreadable) → set `enrichment_status = 'skipped'`
- **Failed** (download error, storage error) → set `enrichment_status = 'failed'`

There are **5 skip/fail points** in the loop that need this update (lines ~179, 194, 241, 247, 253 approximately):

```typescript
// Example for each skip/fail:
results.push({ id: candidate.id, name: candidate.candidate_name, status: 'skipped', error: '...' });
await supabase.from('candidates').update({ enrichment_status: 'skipped' }).eq('id', candidate.id);
continue;
```

And in the catch block at the bottom of the loop:
```typescript
await supabase.from('candidates').update({ enrichment_status: 'failed' }).eq('id', candidate.id);
```

**No schema migration needed** — `enrichment_status` is a text column, not an enum. `'skipped'` and `'failed'` are valid values.

This single change stops the infinite loop: every candidate processed by batch-re-enrich will have its status moved out of `'pending'`, guaranteeing it won't be re-queried.

