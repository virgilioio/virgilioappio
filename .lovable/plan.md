

# Fix: Add "Recruiter" to Offer Form Field Type Selector

## Problem
The "Add Field" section in `OfferFormFieldsManager.tsx` has its own local `ALL_FIELD_TYPES` array that was not updated when the recruiter field type was added. It lists 12 types but is missing `'recruiter'`.

## Fix
**File**: `src/components/settings/OfferFormFieldsManager.tsx` (line 22)

Add `'recruiter'` to the local `ALL_FIELD_TYPES` array:

```ts
const ALL_FIELD_TYPES: OfferFieldType[] = ['text', 'number', 'email', 'url', 'textarea', 'select', 'checkbox', 'date', 'file', 'salary', 'location', 'phone', 'recruiter']
```

Single-line fix, no other changes needed.

