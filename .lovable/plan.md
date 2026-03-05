

# Add Visual Indicators for Approval-Restart Fields in Offer Composer

## Change

**`src/components/candidates/OfferComposerBody.tsx`** (lines 372-384):

When editing an offer that is `pending_approval`, fields with `triggers_approval_restart === true` should show a visual indicator next to their label. Specifically:

1. Add a `RefreshCcw` icon (amber colored) and a tooltip-style text next to the field label for fields where `triggers_approval_restart` is true **and** the offer is currently `pending_approval` (i.e., `editingOfferId` exists and `currentOffer?.status === 'pending_approval'`).
2. The indicator will appear as a small amber `RefreshCcw` icon inline with the label, plus a subtle text like "Editing restarts approval" in amber/muted style.
3. Only show these indicators when editing an existing offer in `pending_approval` status -- not when creating a new offer or editing a draft.

Single file, ~10 lines changed in the field rendering loop.

