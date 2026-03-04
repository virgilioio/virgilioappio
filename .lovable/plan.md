

# Add "Offer Details" Tab to Candidate Profile

## Overview

Add a conditional "Offer Details" tab to the left-column tab bar in the candidate profile sheet. This tab appears only when the candidate's status is `offer` or `hired`, and displays the saved offer form data. When moving a candidate away from offer/hired status, if offer data exists, show a confirmation dialog warning that offer details will be deleted.

## Changes

### 1. New Component: `src/components/candidates/CandidateOfferDetails.tsx`

A read-only display component that:
- Takes `candidateId` and `jobId` as props
- Uses `useOfferLetters(candidateId)` to fetch offer letters for this candidate
- Filters to the offer letter matching the `jobId`
- Fetches the form fields via `useOfferFormFields(offerLetter.form_id)` to get labels and types
- Renders each field as a label-value pair in a clean card layout
- Handles location fields (parse JSON, show city/state/country) and salary fields (show with currency/period)
- Shows empty state if no offer letter exists yet, with a "Create Offer" button

### 2. Update `src/components/candidates/CandidateProfileSheet.tsx`

**Tab state**: Extend `activeTab` type from `'job' | 'application' | 'resume' | 'overview'` to include `'offer'`.

**Tab list** (line 925-931): Conditionally include the "Offer Details" tab only when `associationStatus === 'offer' || associationStatus === 'hired'`:
```tsx
tabs={[
  { value: 'job', label: 'Job Application', Icon: FileText },
  { value: 'application', label: 'Application Details', Icon: FileText },
  { value: 'resume', label: 'Resume', Icon: FileText },
  { value: 'overview', label: 'Overview', Icon: FileText },
  // Conditionally added:
  ...(associationStatus === 'offer' || associationStatus === 'hired'
    ? [{ value: 'offer', label: 'Offer Details', Icon: FileText }]
    : []),
]}
```

**Tab content**: Add an `{activeTab === 'offer' && ...}` block after the overview tab content, rendering the new `CandidateOfferDetails` component.

**Auto-switch tab**: When `activeTab` is `'offer'` and the status changes away from offer/hired, reset `activeTab` to `'job'`.

**Offer deletion on status change**: Add state for a confirmation dialog (`showOfferDeleteWarning`). Modify `handleReturnToPipeline`, `handleReactivate`, and `handleReject` to:
1. Check if offer letters exist for this candidate+job (query `offer_letters` table)
2. If yes, show a confirmation AlertDialog warning: "Moving this candidate will permanently delete their offer details. This action cannot be undone."
3. On confirm: delete the offer_letters records for this candidate+job, then proceed with the status change
4. On cancel: do nothing

The `handleHire` function does NOT trigger this warning (hired candidates keep their offer details).

### 3. Confirmation Dialog

Use the existing `AlertDialog` component inline in `CandidateProfileSheet.tsx`:
- Title: "Delete Offer Details?"
- Description: "Moving this candidate away from the Offer status will permanently delete their offer details. This cannot be undone."
- Actions: "Cancel" and "Continue & Delete"

On confirm, call `supabase.from('offer_letters').delete().eq('candidate_id', candidateId).eq('job_id', jobId)` then execute the pending status change action.

### Files Changed
- **New**: `src/components/candidates/CandidateOfferDetails.tsx`
- **Modified**: `src/components/candidates/CandidateProfileSheet.tsx`

