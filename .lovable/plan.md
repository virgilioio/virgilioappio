

# Fix Saved Tab + Unify Row Design

## Problem 1: Candidates disappearing from "Saved" tab

**Root cause**: The `useSavedCandidates` hook requires `collected_at IS NOT NULL` on `sourcing_preview_candidates` to show a candidate. But the `enrich-apollo-profile` edge function only sets `collected_at` **after** a successful candidate insert. If the insert fails (e.g., candidate with that `apollo_id` already exists from another project), the code hits `continue` and skips the `collected_at` update entirely.

Verified in your current project: 1 candidate exists in the `candidates` table with `apollo_collected_at` set, but the corresponding `sourcing_preview_candidates` row still has `collected_at = null`.

**Fix**: In `enrich-apollo-profile/index.ts`, move the `collected_at` update to run **regardless** of whether the candidate insert succeeds or fails (duplicate). When the insert fails due to a duplicate, look up the existing candidate and still mark `collected_at` on the preview row.

## Problem 2: Row design inconsistency

The Candidates tab uses a rich layout (source badge, match score badge, name with LinkedIn icon, role @ company, metadata chips for location/email/phone, action buttons). The Saved and Archived tabs use a simpler card-based layout with different spacing, icon sizes, and no badges.

**Fix**: Refactor `SavedCandidatesTab` and `ArchivedCandidatesTab` to use the same row structure as `SourcingCandidateTable`:
- Source badge (show "Collected" in pastel-blue)
- Name row with LinkedIn icon
- Role at Company subtitle
- Metadata chips (location, email, phone) in the same pill style
- Right-side actions (archive/restore buttons)
- Remove the current card-based layout and use a Table inside a Card, matching the Candidates tab

## Files Modified

1. **`supabase/functions/enrich-apollo-profile/index.ts`** — After the candidate insert block, add a fallback: if insert fails with duplicate error, query the existing candidate by `apollo_id`, still update `collected_at` on the preview row, and return the existing candidate ID in results (with `already_collected: true`).

2. **`src/components/sourcing/SavedCandidatesTab.tsx`** — Rewrite the candidate list to use Table/TableRow/TableCell with the same visual pattern as `SourcingCandidateTable`: badge + name + subtitle + metadata chips + actions.

3. **`src/components/sourcing/ArchivedCandidatesTab.tsx`** — Same row redesign as SavedCandidatesTab, with restore button instead of archive.

4. **`src/hooks/useSavedCandidates.ts`** — Minor: also include candidates with status `shortlisted` (not just `active`) since shortlisted is still a "saved" state. The `not_a_fit` ones should stay hidden from the Saved tab.

