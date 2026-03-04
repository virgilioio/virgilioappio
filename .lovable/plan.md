

# Convert Offer Form to Minimizable Overlay with Draft Support

## What changes

Replace the current `Sheet`-based `CreateOfferLetterSheet` with a minimizable floating overlay (matching the `MinimizableEmailComposer` pattern), and add localStorage-based draft persistence.

## Changes

### 1. New component: `src/components/candidates/MinimizableOfferComposer.tsx`

A wrapper component modeled on `MinimizableEmailComposer.tsx`:
- Fixed position overlay at bottom-right (`absolute bottom-4 right-4 z-[60]`)
- Header bar with title ("Create Offer — {candidateName}"), minimize/expand toggle, and close button
- When minimized: compact bar showing just the title (same dimensions as email composer)
- When expanded: scrollable content area rendering the offer form fields (form selector, dynamic fields, save button)
- On close: if there are field values filled in, auto-save draft to localStorage before closing (key: `offer-draft-{candidateId}`)

### 2. Refactor `CreateOfferLetterDialog.tsx` → extract form body

Extract the form body (form selector, dynamic fields, action buttons) into an inline section within the new `MinimizableOfferComposer`. The component keeps the same hooks (`useOfferForms`, `useOfferFormFields`, `useOfferLetters`) and logic, just rendered inside the overlay instead of a Sheet.

### 3. Draft persistence (localStorage)

- **Draft key**: `offer-draft-{candidateId}`
- **Auto-save on close**: When closing with unsaved field values, save `{ selectedFormId, fieldValues, lastUpdated }` to localStorage
- **Restore on open**: On mount, check for a draft. If found, restore `selectedFormId` and `fieldValues`, show a subtle toast or inline indicator ("Draft restored")
- **Clear on successful save**: After `createOfferLetter` succeeds, remove the draft from localStorage
- **Auto-save on field change**: Debounced save (e.g. 2s after last change) so progress is continuously preserved

### 4. Update consumers

- **`CandidateProfileSheet.tsx`**: Replace `<CreateOfferLetterSheet>` with `<MinimizableOfferComposer>` — same props, different rendering
- **`CandidateProfile.tsx`**: Same replacement
- Both already have the `open`/`onOpenChange` state that will drive the overlay visibility

### 5. Visual spec

- Expanded width: `w-[720px] max-w-[min(95vw,720px)]` (matches email composer)
- Max content height: `max-h-[600px] overflow-y-auto`
- Minimized: `w-[432px] h-[52px]`
- Header: `bg-muted/30`, cursor pointer to toggle minimize
- Same shadow, border, and animation classes as `MinimizableEmailComposer`

