

# Smart Offer Fields: Remove Profile Sync, Add Context Awareness

## The Idea

You're absolutely right. In job application forms, smart fields (salary, location, phone) sync to the candidate profile — that makes sense because there's one salary expectation per candidate. But in offer forms, you might have Base Salary, Variable Comp, and OTE as three separate salary fields. Syncing all three to one profile field is nonsensical.

The solution: make the shared `FormFieldEditor` context-aware. Job posting fields keep "Syncs to Profile" messaging. Offer form fields show the same structured UI (currency picker, location sub-fields, etc.) but without any sync language — they're "Smart Offer Fields" that standardize data capture only.

## Changes

### 1. Add `context` prop to `FormFieldEditor`
**File**: `src/components/shared/FormFieldEditor.tsx`

Add a new optional prop `context?: 'job_posting' | 'offer'` (default: `'job_posting'`). Use it to conditionally:
- **Hide** the "Syncs to Candidate Profile" title in `SyncConfigPanel` when context is `'offer'` — replace with "Structured Field" or "Smart Field Configuration"
- **Hide** the blue "Syncs to Profile" badges in view mode when context is `'offer'`
- Keep all the config UI (currency, period, location sub-fields, phone country code) intact — that's the "smart" part

### 2. Pass `context="offer"` from `OfferFieldEditor`
**File**: `src/components/settings/OfferFieldEditor.tsx`

Pass `context="offer"` to the shared `FormFieldEditor`. This is the only call site for offer forms.

### 3. Pass `context="job_posting"` from `FieldEditor` (explicit, no behavior change)
**File**: `src/components/jobs/postings/FieldEditor.tsx`

Explicitly pass `context="job_posting"` for clarity. No behavior change since it's the default.

### 4. Update `OfferFormFieldsManager` config panels
**File**: `src/components/settings/OfferFormFieldsManager.tsx`

The "Add Field" section has its own inline config panels for salary/location/phone. Update the purple header text from "Salary Configuration" / "Location Configuration" / "Phone Configuration" to remove any sync language (these already don't mention sync, so just verify they stay clean).

### 5. Update Style Guide
**File**: `src/components/settings/styleguide/SmartFieldsGuide.tsx`

Add a note distinguishing the two contexts: Job posting smart fields sync to profile; Offer smart fields provide structured data capture without sync.

## Summary of file changes
- **Modified**: `src/components/shared/FormFieldEditor.tsx` — add `context` prop, conditionally hide sync messaging
- **Modified**: `src/components/settings/OfferFieldEditor.tsx` — pass `context="offer"`
- **Modified**: `src/components/jobs/postings/FieldEditor.tsx` — pass `context="job_posting"` explicitly
- **Modified**: `src/components/settings/styleguide/SmartFieldsGuide.tsx` — document both contexts

