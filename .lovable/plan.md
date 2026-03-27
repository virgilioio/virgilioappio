

# Add "Unhire" Button to Hired Banner

## What changes

Add an "Unhire" button to `HiredStatusBanner` that returns the candidate to the `offer` status while preserving all offer data. This mirrors the "Reactivate" button on the rejection banner and the "Create Offer" button on the offer banner.

## Key behavior

- Clicking "Unhire" sets the association status back to `offer`
- Offer data (`offer_letters`, `offered_at`, `offered_by`) is **preserved** — not deleted
- `hired_at` and `hired_by` are cleared (set to null)
- The Offer tab remains visible and editable
- Offer data is only lost when returning to the pipeline (active status), which already works via `handleReactivate` → `checkOfferAndProceed`

## Files changed

| File | Change |
|------|--------|
| `src/components/candidates/HiredStatusBanner.tsx` | Add `onUnhire` callback prop; render "Unhire" button (outline style matching rejection banner pattern) |
| `src/components/candidates/CandidateProfileSheet.tsx` | Add `handleUnhire` function that updates status to `offer`, clears `hired_at`/`hired_by`, restores offer banner state, and re-shows Offer tab. Pass `onUnhire` to `HiredStatusBanner`. |

## handleUnhire logic

```
1. Update association: status='offer', hired_at=null, hired_by=null
2. setAssociationStatus('offer')
3. setHiredDetails(null)
4. Restore offerDetails state (already loaded from DB if it exists)
5. onStageChanged?.() to refresh pipeline
6. Toast: "Candidate returned to offer stage"
```

## Visual result

```text
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Candidate Hired                                    [Unhire] │
│  Account Executive, Enterprise • Mar 27, 2026                  │
│  Source: LinkedIn • Recruiter: Allan Bravo                      │
└─────────────────────────────────────────────────────────────────┘
```

