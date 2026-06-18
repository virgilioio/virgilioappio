## Root cause

Submitted scorecards stop appearing in **Job Overview → Scorecards card** and **Scorecards tab → per-stage card** because both card components own their own `useAllStageScorecards(...)` instance. That hook fetches once on mount and is **not refetched** when `ScorecardSheet` saves.

In `CandidateProfileSheet.tsx`, the save handler (line 1856-1861) only calls `refetchScorecards()`, which is the `useMyScorecards` refetch (drives the "Add / AI Draft" button state). The two card components keep their stale snapshot:

- `StageScorecardsCard` (Job Overview tab, used at line 1332) → its own `useAllStageScorecards` hook.
- `StageScorecards` wrapper around `ExpandableScoreDisplay` (Scorecards tab, used at line 1526) → its own `useAllStageScorecards` hook.

Result: a freshly submitted scorecard exists in `job_stage_scorecards` with `is_ai_draft = false` and a real `rating`, but neither card sees it until the profile sheet is reopened.

Secondary bug in `src/hooks/useAllStageScorecards.ts` lines 35-38:

```ts
const isAdminOrRecruiter = permissions.isAdmin || permissions.isPlatformAdmin ||
  (permissions as any).isWorkspaceOwner !== undefined
    ? !!(permissions as any).canManageMembers
    : false;
```

`||` binds tighter than `?:`, so this collapses to `!!canManageMembers` for nearly every user (because `isWorkspaceOwner !== undefined` is almost always true). That breaks the visibility filter on `public` scorecard templates — teammates' submissions can be silently hidden.

## Fix plan

### 1. Refresh per-stage card lists after every scorecard save/delete

In `src/components/candidates/CandidateProfileSheet.tsx`:

- Add a `scorecardsRefreshNonce` state (number, starts at 0).
- Bump it in the `ScorecardSheet` `onSubmit` and `onDelete` handlers (right after `refetchScorecards()`), and also after the existing `handleDismissAiDraft` flow.
- Pass `refreshNonce={scorecardsRefreshNonce}` to:
  - `<StageScorecardsCard … />` at line 1332 (Job Overview tab).
  - `<StageScorecards … />` at line 1526 (Scorecards tab wrapper).

In `src/components/candidates/profile/StageScorecardsCard.tsx`:

- Accept an optional `refreshNonce?: number` prop.
- Wire it as a dependency of the internal `useAllStageScorecards` fetch by either (a) calling `refetch()` in a `useEffect([refreshNonce])`, or (b) passing the nonce into the hook via a new optional `refreshKey` parameter that's added to its `useEffect` dep list.

In `CandidateProfileSheet.tsx`'s inline `StageScorecards` component (lines 108-137):

- Accept `refreshNonce?: number` and call `refetch()` in a `useEffect([refreshNonce])`.

Approach (b) — add an optional `refreshKey?: number | string` parameter to `useAllStageScorecards` — is preferred: it's one line in the hook, both consumers just forward the prop, and behavior stays inside the hook.

### 2. Fix the visibility-filter precedence bug

In `src/hooks/useAllStageScorecards.ts`:

Replace lines 35-38 with explicit parentheses and the actual intent:

```ts
const isAdminOrRecruiter =
  permissions.isAdmin ||
  permissions.isPlatformAdmin ||
  !!(permissions as any).isWorkspaceOwner ||
  !!(permissions as any).canManageMembers;
```

This restores the "admins, owners, and recruiters see all submitted scorecards on a `public` template" behavior so that on multi-reviewer stages, the freshly-submitted card from another teammate also surfaces.

### 3. Verification

After the change, with the sheet open:

- Submit a scorecard from `ScorecardSheet` → the row appears immediately in the Job Overview tab's Scorecards card (correct rating badge, author, snippet) and in the Scorecards tab's per-stage block.
- Edit and re-save the rating → both surfaces show the updated rating without remounting the sheet.
- Delete a scorecard → it disappears from both surfaces.
- The AI-draft banner still works: submitting an AI draft flips `is_ai_draft=false` (already handled in `ScorecardSheet.handleSave`) and the row migrates from the lilac banner into the human-submitted list.

## Files touched

- `src/hooks/useAllStageScorecards.ts` — add optional `refreshKey` param threaded into the fetch effect; fix `isAdminOrRecruiter` precedence.
- `src/components/candidates/profile/StageScorecardsCard.tsx` — accept and forward `refreshNonce`.
- `src/components/candidates/CandidateProfileSheet.tsx` — add `scorecardsRefreshNonce` state, bump it after submit/delete/dismiss-AI, pass it to both card surfaces; also forward it through the inline `StageScorecards` wrapper.

## Non-goals

- No DB schema changes. `job_stage_scorecards.is_ai_draft` already flips correctly inside `ScorecardSheet.handleSave`.
- No restyle of the cards — only the data-freshness wiring and the precedence bug.
- No changes to `ExpandableScoreDisplay`'s render shape — it receives the (now fresh) `scorecards` array as before.
