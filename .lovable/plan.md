## Problem
In the candidate profile's **Job Overview** tab, the **Application Details** card (`CandidateApplicationResponses.tsx`) truncates `textarea` answers at 200 characters with `...` and offers no way to read the rest.

## Solution
Replace the static truncation with a per-answer expand/collapse, following the existing pattern used in `EmailHistoryCard.tsx`.

## Plan
1. **Modify `src/components/candidates/CandidateApplicationResponses.tsx`**:
   - Introduce a small inline `ExpandableAnswer` component that keeps the first ~200 characters visible.
   - Add a "Show more" / "Show less" button (ghost style, ChevronDown/ChevronUp) when the answer exceeds 200 characters.
   - Use local `useState` per answer row to track expanded state.
   - Preserve existing formatting: `whitespace-pre-wrap`, existing link/email/phone formatting for other field types unchanged.

## Out of scope
- No changes to data fetching, filtering, or other field types.
- No changes to the parent `CandidateProfileSheet` card layout.

## Verification
- Open a candidate profile with a long textarea application response.
- Confirm the text is initially truncated and a "Show more" button appears.
- Clicking expands to full text; "Show less" collapses it back.