

# Move "Offer Details" Tab to First Position

## Change

**File: `src/components/candidates/CandidateProfileSheet.tsx`** (around line 987-991)

Move the conditional Offer Details entry from the end of the tabs array to the beginning:

```tsx
tabs={[
  ...((associationStatus === 'offer' || associationStatus === 'hired')
    ? [{ value: 'offer', label: 'Offer Details', Icon: FileText }]
    : []),
  { value: 'job', label: 'Job Application', Icon: FileText },
  { value: 'application', label: 'Application Details', Icon: FileText },
  { value: 'resume', label: 'Resume', Icon: FileText },
  { value: 'overview', label: 'Overview', Icon: FileText },
]}
```

Also set the default `activeTab` to `'offer'` when the candidate is in offer/hired status, so the tab is auto-selected when opening the profile.

