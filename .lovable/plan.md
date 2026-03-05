

# Add Edit Button to Offer Details Card Header

## Approach

Add an `onEdit` callback prop to `CandidateOfferDetails`. In the card header, render a compact button row with **Edit** (pencil icon, ghost sm) and **Request Approval** (send icon, ghost sm) next to the status badge. The Edit button opens the `MinimizableOfferComposer` pre-filled with the existing offer data.

**Edit availability rules:**
- Visible when status is `draft` (offer hasn't entered approval yet)
- Hidden when `pending_approval`, `finalized`, `sent`, `accepted`, or `declined`

**Header layout:**

```text
┌──────────────────────────────────────────────────┐
│ Offer Details     [Edit] [Request Approval] [Draft] │
│                   ghost   ghost sm           badge   │
└──────────────────────────────────────────────────┘
```

## Changes

### 1. `src/components/candidates/CandidateOfferDetails.tsx`
- Add `onEdit?: () => void` prop
- Render an **Edit** ghost/sm button (Pencil icon) in the header actions row, visible only when status is `draft`
- Keep Request Approval button as-is

### 2. `src/components/candidates/CandidateProfileSheet.tsx`
- Pass `onEdit={() => setOfferFormOpen(true)}` to `CandidateOfferDetails`
- The existing `MinimizableOfferComposer` already restores drafts from localStorage and handles pre-filling — opening it again lets the recruiter edit

### Files
| Action | File |
|--------|------|
| Modify | `src/components/candidates/CandidateOfferDetails.tsx` — add `onEdit` prop + Edit button |
| Modify | `src/components/candidates/CandidateProfileSheet.tsx` — pass `onEdit` callback |

