
# Move WhatsApp Icon to Left of Copy Icon

## Current State
- **`CandidateProfileSheet.tsx`** (job context): In the contact_phones list, Copy icon appears first, WhatsApp second. In the fallback single-phone section, there's no WhatsApp icon at all.
- **`IndependentCandidateProfileSheet.tsx`**: Already has WhatsApp before Copy in both sections — no changes needed.

## Changes

### `src/components/candidates/CandidateProfileSheet.tsx`

1. **Contact phones array (lines 1376-1397)**: Swap the order — move the WhatsApp button before the Copy button.

2. **Fallback single phone (lines 1418-1427)**: Add a WhatsApp button before the existing Copy button, matching the same pattern used in the contact_phones section (opens chat tab with that phone number).
