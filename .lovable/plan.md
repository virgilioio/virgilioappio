

# Fix All Broken Placeholders in Email Template Resolution

## Problem

Almost no placeholders resolve correctly. The root causes:

1. **`useApplicationReview.ts` `handleReject`** passes barely any data to `buildPlaceholderData`:
   - Candidate: only `candidate_name` and `email` (missing phone, location)
   - Job: hardcoded empty string `''` for title (never fetched)
   - Sender: not passed at all
   - Organization/department: not passed at all

2. **`buildPlaceholderData` utility** has no parameters for `organization.name` or `department.name` — even if callers wanted to pass them, they can't.

3. **`useBulkRejectCandidates.ts`** has the same gaps: no sender, no organization, no department.

## Fix

### 1. Extend `buildPlaceholderData` in `src/utils/templateUtils.ts`

Add `organizationName` and `departmentName` as optional parameters:

```typescript
export function buildPlaceholderData(options: {
  candidate?: { ... };
  job?: { ... };
  sender?: { ... };
  bookingLink?: string;
  organizationName?: string;   // NEW — tenant name
  departmentName?: string;     // NEW — organization/folder name
}): PlaceholderData {
  // ... existing logic ...
  if (options.organizationName) {
    data['organization.name'] = options.organizationName;
  }
  if (options.departmentName) {
    data['department.name'] = options.departmentName;
  }
  return data;
}
```

### 2. Fix `useApplicationReview.ts` `handleReject`

When `shouldSendEmail` is true, fetch all needed data in one parallel batch:

```
const [templateResult, identityResult, senderProfile, jobData] = await Promise.all([
  // template (already there)
  // mail identity (already there)
  // NEW: sender profile
  supabase.from('profiles').select('first_name, last_name, email, title, phone, linkedin_url')
    .eq('user_id', user.id).single(),
  // NEW: job with tenant + organization names
  supabase.from('jobs').select('title, department, location, tenant:tenants!inner(name), organization:organizations!inner(name)')
    .eq('id', jobId).single(),
]);
```

Then pass everything to `buildPlaceholderData`:

```typescript
const placeholderData = buildPlaceholderData({
  candidate: {
    candidate_name: currentCandidate.candidateName,
    email: currentCandidate.email,
    phone: currentCandidate.phone,
    location_city: currentCandidate.locationCity,
    location_state: currentCandidate.locationState,
    location_country: currentCandidate.locationCountry,
  },
  job: {
    title: jobData?.title,
    department: jobData?.department,
    location: jobData?.location,
  },
  sender: {
    first_name: senderProfile?.first_name,
    last_name: senderProfile?.last_name,
    email: senderProfile?.email || identityResult.data.email_address,
    title: senderProfile?.title,
    phone: senderProfile?.phone,
    linkedin_url: senderProfile?.linkedin_url,
  },
  organizationName: jobData?.tenant?.name,
  departmentName: jobData?.organization?.name,
});
```

### 3. Fix `useBulkRejectCandidates.ts` (same pattern)

Add sender profile and org/tenant name fetches, pass them to `buildPlaceholderData`.

### 4. Fix `useBulkSendEmail.ts`

Already fetches sender profile and job data — just needs org/tenant names added to its job query and passed to `buildPlaceholderData`.

### Files changed

| File | Change |
|------|--------|
| `src/utils/templateUtils.ts` | Add `organizationName` + `departmentName` params to `buildPlaceholderData` |
| `src/hooks/useApplicationReview.ts` | Fetch sender profile, job+tenant+org data; pass full data to `buildPlaceholderData` |
| `src/hooks/useBulkRejectCandidates.ts` | Add sender profile + org/tenant fetches; pass to `buildPlaceholderData` |
| `src/hooks/useBulkSendEmail.ts` | Add org/tenant names to job query; pass to `buildPlaceholderData` |

