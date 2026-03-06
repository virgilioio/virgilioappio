

# Collapse by Default + Smooth Animation for AI Profile Summary

## 4 changes:

### 1. AI Profile Summary — collapse by default + smooth animation
**File**: `IndependentCandidateProfileSheet.tsx` line 395

- Remove `defaultOpen` from `<Collapsible>`
- Add smooth expand/collapse animation to `<CollapsibleContent>` using the same CSS transition pattern as accordion: `className="overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"`

### 2. Skills — collapse by default
**File**: `IndependentCandidateProfileSheet.tsx` line 392

Change `defaultValue={['summary', 'experience', 'education', 'certifications', 'skills']}` to `defaultValue={['experience', 'education', 'certifications']}`

### 3. Attachments — collapse by default
**File**: `CandidateAttachments.tsx` lines 111, 131

Remove `defaultValue="attachments"` from both `<Accordion>` instances.

### 4. URLs — collapse by default
**File**: `CandidateUrls.tsx` lines 77, 96

Remove `defaultValue="urls"` from both `<Accordion>` instances.

### Files changed
- `src/components/candidates/IndependentCandidateProfileSheet.tsx`
- `src/components/candidates/CandidateAttachments.tsx`
- `src/components/candidates/CandidateUrls.tsx`

