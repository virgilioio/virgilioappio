

# Pre-fill Offer Composer When Editing an Existing Offer

## Problem

Clicking "Edit" on an existing offer opens the `MinimizableOfferComposer` blank — it only restores from localStorage drafts, not from the saved `offer_letter` record in the database. The recruiter has to re-select the form and re-enter all fields.

## Solution

Pass the existing offer data into the composer so it pre-fills the form selector and all field values on open.

### Changes

**1. `MinimizableOfferComposer.tsx`** — Add optional `editingOffer` prop

- New prop: `editingOffer?: { id: string; form_id: string; field_values: Record<string, any> } | null`
- On open, if `editingOffer` is provided, use its `form_id` and `field_values` instead of localStorage draft (editing takes priority over draft)
- Change header title to "Edit Offer" when editing vs "Create Offer" when creating
- On save success, clear the editingOffer state via a callback

**2. `OfferComposerBody.tsx`** — Support update mode

- New optional prop: `editingOfferId?: string`
- When `editingOfferId` is set, the save button calls `updateOfferLetter(id, { field_values, form_id })` instead of `createOfferLetter(...)`
- Button label changes: "Update Offer" vs "Save Offer"
- The form selector can be locked or remain editable (recommend keeping it editable so the recruiter can switch forms if needed)

**3. `CandidateProfileSheet.tsx`** — Pass offer data when editing

- Add state: `editingOffer` (stores the offer letter data from `CandidateOfferDetails`)
- Change `onEdit` callback to pass the offer data: `onEdit={(offer) => { setEditingOffer(offer); setOfferFormOpen(true) }}`
- Pass `editingOffer` to `MinimizableOfferComposer`
- Clear `editingOffer` when composer closes

**4. `CandidateOfferDetails.tsx`** — Update `onEdit` signature

- Change prop from `onEdit?: () => void` to `onEdit?: (offer: { id: string; form_id: string; field_values: Record<string, any> }) => void`
- Pass the offer letter data when calling `onEdit`

### Files

| Action | File |
|--------|------|
| Modify | `src/components/candidates/MinimizableOfferComposer.tsx` — add `editingOffer` prop, pre-fill on open |
| Modify | `src/components/candidates/OfferComposerBody.tsx` — add `editingOfferId` prop, support update vs create |
| Modify | `src/components/candidates/CandidateProfileSheet.tsx` — track `editingOffer` state, pass to composer |
| Modify | `src/components/candidates/CandidateOfferDetails.tsx` — pass offer data in `onEdit` callback |

