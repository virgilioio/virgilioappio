# Advance to Offer at last pipeline stage

When a candidate sits on the final pipeline stage, the "Advance to …" button currently disappears from both the candidate profile hero (top-right) and the Quick Actions card. Replace that empty state with an "Advance to Offer" button in both places, which moves the candidate's association status to `offer` (the same action used elsewhere in the sheet).

## Behaviour

- Candidate has a next stage → unchanged: "Advance to {next stage name}" moves to next stage.
- Candidate is on the last stage AND status is `active` → show "Advance to Offer" in both spots, which calls the existing `handleMoveToOffer` flow (sets status `offer`, stamps `offered_at`/`offered_by`).
- Candidate status is already `offer`, `hired`, or `rejected` → button stays hidden (matches current rules; Quick Actions still shows "Create offer" when status is `offer`).

## Files to change

1. **`src/components/candidates/CandidateProfileSheet.tsx`**
   - In both `ProfileHeroCard` and `ProfileQuickActionsCard` call sites (~lines 1096–1154 and ~1543–1571), derive:
     - `atLastStage = currentIdx >= 0 && nextStage == null`
     - `advanceToOffer = atLastStage && associationStatus === 'active'`
     - `effectiveNextStageLabel = nextStage?.stage.stage_name ?? (advanceToOffer ? 'Offer' : null)`
     - `effectiveOnAdvance = nextStage ? <existing move handler> : (advanceToOffer ? handleMoveToOffer : undefined)`
   - Pass those into the two components instead of the raw `nextStage`-based values.

2. **`src/components/candidates/profile/ProfileHeroCard.tsx`** and **`src/components/candidates/profile/ProfileQuickActionsCard.tsx`**
   - No structural changes required; the existing render condition `{nextStageLabel && !isRejected && !isHired && onAdvance && (...)}` already handles the new case once the parent passes `nextStageLabel="Offer"` and an `onAdvance` handler. Verify the label renders cleanly as "Advance to Offer".

## Out of scope

- No changes to `handleMoveToOffer`, `usePipelineActions`, or DB logic.
- No new copy variants beyond the literal label "Offer".
- No styling changes to the buttons themselves.
