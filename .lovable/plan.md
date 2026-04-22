

## Fix "out of range for type integer" when saving the Hiring Plan

### Root cause
`useJobHiringPlan.ts` Phase 0 normalization seeds temporary positions with `Date.now()` (~1.77 trillion). The DB column `job_hiring_stages.position` is `integer` (max 2,147,483,647). Postgres rejects with `22003` and the whole save aborts.

The intent of Phase 0 is correct (clear stale temp blocks left by prior crashes so Phase 1 / Phase 2 don't collide on the unique `(job_id, position)`). The seed value just needs to fit in an int4.

### Fix — single file: `src/hooks/useJobHiringPlan.ts`

Replace the `Date.now()`-seeded loop in Phase 0 with a safe in-range temp block. Use a high but valid offset that cannot collide with Phase 1 (`10000+`), Phase 2 (`20000+`), or final (`1..n`) blocks.

Change:
```ts
const epoch = Date.now()
for (let i = 0; i < (currentPlan || []).length; i++) {
  const { error: normErr } = await supabase
    .from('job_hiring_stages')
    .update({ position: epoch + i })
    .eq('id', currentPlan[i].id)
  if (normErr) throw normErr
}
```
to:
```ts
// Phase 0: park all current rows in a unique temp block (30000+) that fits in int4
// and cannot collide with Phase 1 (10000+), Phase 2 (20000+), or final (1..n).
for (let i = 0; i < (currentPlan || []).length; i++) {
  const { error: normErr } = await supabase
    .from('job_hiring_stages')
    .update({ position: 30000 + i + 1 })
    .eq('id', currentPlan[i].id)
  if (normErr) throw normErr
}
```

30000 + N stays well under int4 max even with thousands of stages and is disjoint from the other two temp blocks already used by the function.

### Why not change the column to `bigint`?
Not needed. Positions are small ordinals (1..n per job). The bug is purely the temp seed value. Keeping `integer` avoids a migration, avoids touching every dependent query/type, and the existing block-based scheme already guarantees uniqueness within a single save.

### Out of scope
- DB schema changes (no migration needed).
- Refactoring the 4-phase save into a single RPC (separate hardening task).
- `loadHiringPlan` / `loadHiringPlanInstances` / candidate reassignment logic — unaffected.

### Files touched
- `src/hooks/useJobHiringPlan.ts` (one loop, ~6 lines)

### Verification
1. Open a job → Hiring Plan → add/remove/reorder stages → Save. Toast: "Hiring Plan Saved".
2. Re-open: order persists, candidates remain on their stages (or are moved to the previous stage when a stage is removed).
3. Save again immediately (no page reload) — still succeeds (proves Phase 0 properly clears prior temp positions).

