

# Remove Empty State, Show Chain as Inactive When No Request

## What Changes

**`src/components/candidates/CandidateOfferApprovals.tsx`**

Replace the `!approvalRequest` block (lines 46–99) with two cases:

1. **Has configured chain** — Show the steps timeline directly (same structure as now) but with reduced opacity (`opacity-50`) on everything to convey "inactive/not yet started". No Gio face, no text message. Just the grayed-out steps timeline taking up the space.

2. **No configured chain** — Show a minimal centered message (no Gio face, no branded text): just a simple `text-sm text-muted-foreground` line like "No approval chain configured for this job."

Also remove the `gioFaceEmpty` import since it's no longer used here.

