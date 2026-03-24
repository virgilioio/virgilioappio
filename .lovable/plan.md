
Fix the PDF export so the contact toggle only affects contact info, not the rest of the profile.

## Root cause

The generator itself is already correct: in `src/utils/candidatePdfGenerator.ts`, only the contact block is gated by `if (includeContactDetails)`, while enrichment metadata, work experience, education, and certifications are outside that condition.

The real issue is inconsistent data being passed into the generator from different entry points:

- `src/components/candidates/IndependentCandidateProfileSheet.tsx` passes:
  - `candidate`
  - `workExperience`
  - `education`
  - `certifications`
- `src/components/candidates/CandidateProfileSheet.tsx` passes:
  - `candidate`
  - `job`
  - `workExperience`
  - `education`
  - but not `certifications`
- `src/pages/CandidateProfile.tsx` passes only:
  - `candidate`
  - `job`
  - `organization`
  - and does not fetch/pass `workExperience`, `education`, or `certifications`

Also, in `CandidateProfileSheet.tsx`, the related-data loading is incomplete: it fetches job and association data, but does not actually load `candidate_work_experience`, `candidate_education`, or `candidate_certifications`, even though those state variables exist.

That explains the “sometimes it shows, sometimes it doesn’t” behavior depending on where the download is triggered.

## Fix

### 1. Make all download entry points pass the same PDF data
Standardize the `pdfOptions` passed to `CandidateProfileDownloadDialog` so every screen provides the same profile sections.

#### `src/components/candidates/CandidateProfileSheet.tsx`
- Load and store:
  - `candidate_work_experience`
  - `candidate_education`
  - `candidate_certifications`
- Pass all three arrays into `pdfOptions`

#### `src/pages/CandidateProfile.tsx`
- Add local state for:
  - `workExperience`
  - `education`
  - `certifications`
- Fetch these tables when candidate changes
- Pass them into `CandidateProfileDownloadDialog`

### 2. Add certifications support to the job-context sheet
`CandidateProfileSheet.tsx` currently has no `certifications` state at all, so the PDF can never include them from that flow.

Add:
- `const [certifications, setCertifications] = useState<CandidateCertification[]>([])`
- import the `CandidateCertification` type
- fetch `candidate_certifications`
- pass `certifications` into `pdfOptions`

### 3. Keep the toggle scoped to contact details only
No structural PDF rewrite needed. Keep `src/utils/candidatePdfGenerator.ts` logic as-is, but verify these rules remain true:

- Toggle ON:
  - show contact info
  - show enrichment metadata
  - show work experience
  - show education
  - show certifications

- Toggle OFF:
  - hide only contact info
  - still show enrichment metadata
  - still show work experience
  - still show education
  - still show certifications

## Files to update

| File | Change |
|---|---|
| `src/components/candidates/CandidateProfileSheet.tsx` | Add certifications state + fetch work experience/education/certifications + pass all into dialog |
| `src/pages/CandidateProfile.tsx` | Fetch work experience/education/certifications and pass all into dialog |
| `src/utils/candidatePdfGenerator.ts` | Keep contact toggle scoped only to contact block; optionally add a small defensive comment for clarity |

## Technical notes

- `CandidateProfileSheet.tsx` already has `workExperience` and `education` state, but they are never populated.
- `IndependentCandidateProfileSheet.tsx` already follows the intended pattern and should remain the reference implementation.
- `useCandidates()` does not include enrichment fields like `seniority_level`, `functional_area`, or `years_experience`, so if the standalone page needs those in the PDF, it may also need to fetch the full candidate row directly rather than rely only on the hook’s reduced shape.
- If needed, align all three entry points around a shared “full candidate for PDF” loading pattern to avoid future drift.

## Expected result

After implementation:
- Turning off the contact toggle removes only phone/email/location/LinkedIn from the PDF
- Enrichment metadata still appears
- Work experience still appears
- Education still appears
- Certifications still appear
- Export behavior is consistent whether the user downloads from job sheet, independent candidate sheet, or full candidate page
