

## Bug: Saving hiring plan fails with duplicate position constraint violation

### Root cause

The `saveHiringPlan` function in `src/hooks/useJobHiringPlan.ts` uses a 4-phase approach: (1) move kept rows to temp positions 10001+, (2) insert new rows at 20001+, (3) delete removed rows, (4) finalize all to 1..n.

The problem: **if any previous save crashes between Phase 1 and Phase 4** (network error, browser close, timeout), rows are left stranded at positions 10001–10005, 20001, etc. On the next save attempt, Phase 1 tries to move rows to 10001, 10002 … — but those positions are **already occupied by other rows** from the dirty state. Result: `23505 duplicate key violation` on `job_hiring_stages_job_position_unique`.

Confirmed by inspecting the active Arqademy "Growth & GTM Marketing Specialist" job (`ab605dd1`): its 6 stages are currently at positions `10001, 10002, 10003, 10004, 10005, 20001` — a textbook dirty state from a prior interrupted save.

### Fix

**`src/hooks/useJobHiringPlan.ts`** — two changes:

1. **Phase 0 (new): Normalize ALL current rows to a unique temp range before doing anything.** Instead of only moving `toKeep` rows, move every row in `currentPlan` to a timestamp-seeded temp range (`Date.now() + index`). This guarantees the 10000+ and 20000+ ranges are clear regardless of prior state. After Phase 0, the kept/inserted temp positions use a different offset block (10000+ and 20000+) that is now guaranteed empty.

   Concretely:
   ```ts
   // Phase 0: Clear all current positions to a unique high range
   const epoch = Date.now()
   for (let i = 0; i < (currentPlan || []).length; i++) {
     await supabase
       .from('job_hiring_stages')
       .update({ position: epoch + i })
       .eq('id', currentPlan[i].id)
   }
   ```

2. **Batch the final position updates** in Phase 4 to reduce the number of sequential writes (minor perf improvement).

**Data repair**: Also fix the currently-stuck job by updating its 6 rows to positions 1–6 so the user doesn't have to re-save to recover.

### Files touched

1. `src/hooks/useJobHiringPlan.ts` — add Phase 0 normalization before Phase 1
2. Data fix (one-time): update the 6 rows for job `ab605dd1` to positions 1–6

No DB schema changes.

