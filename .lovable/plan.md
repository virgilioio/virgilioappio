

# Move "Request Approval" Button to Card Header

## Recommendation

Place the button inline in the `CardHeader`, right next to the status badge. Use `ghost` variant with `size="sm"` — compact, unobtrusive, and consistent with your style guide. The header row becomes:

```text
┌─────────────────────────────────────────────┐
│ Offer Details    [Request Approval] [Draft] │
│                   (ghost sm btn)    (badge)  │
└─────────────────────────────────────────────┘
```

When status is `pending_approval`, the button is replaced by just the badge (which already says "Pending Approval" in purple). Clean and minimal.

## Changes

**File: `src/components/candidates/CandidateOfferDetails.tsx`**

1. Move the "Request Approval" button into the `CardHeader` `div` (line 112-117), between the title and the badge
2. Change to `variant="ghost" size="sm"` — no full-width, no heavy styling
3. Remove the bottom `pt-2` button blocks (lines 173-194)
4. For `pending_approval` status, the existing badge already communicates it — no separate disabled button needed

