

# Candidate Application Activity in Profile Feed — Audit Results

## Current Status: Already Working

The system IS recording application activities when candidates apply through public job posts:

- The `public-submit-application` edge function calls `log_activity` with `activity_type: 'candidate_added'` and `title: 'Applied via job posting'`
- Database confirms these records exist (verified 10+ recent entries)
- The `get_candidate_activities` function correctly returns them (matches on `entity_id` + `entity_type = 'candidate'`)
- The activity feed UI maps `candidate_added` to a green `UserPlus` icon

**So the feed should already show "Applied via job posting" entries.** If you're not seeing them for a specific candidate, it may be an org-mismatch edge case.

## Recommended Improvement: Dedicated `candidate_applied` Type

Currently, "applied via posting" and "manually added to a job" both use `candidate_added`, making them visually identical in the feed. Adding a distinct type would make the feed clearer.

### Changes

1. **Database migration**: Add `'candidate_applied'` to the `activity_type` enum

2. **`supabase/functions/public-submit-application/index.ts`**: Change `p_activity_type` from `'candidate_added'` to `'candidate_applied'`

3. **`supabase/functions/talent-apply-webhook/index.ts`**: Already uses `'candidate_applied'` in direct insert — it will now match the enum

4. **`src/utils/activityHelpers.tsx`**: Add `candidate_applied` entry with a distinct icon (e.g., `Send` or `FileText`) and color to differentiate from manual adds

5. **`src/components/candidates/ActivityFeedItem.tsx`**: No changes needed — it already uses the helper functions dynamically

### Result

- "Applied via job posting" gets a visually distinct treatment (different icon/color)
- "Candidate added to job" (manual) keeps its current treatment
- Both show correctly in the candidate profile activity feed

| File | Change |
|------|--------|
| Migration | Add `candidate_applied` to `activity_type` enum |
| `supabase/functions/public-submit-application/index.ts` | Use `candidate_applied` instead of `candidate_added` |
| `src/utils/activityHelpers.tsx` | Add icon + color for `candidate_applied` |

