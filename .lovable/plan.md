

# Fix: WhatsApp Template Placeholders Not Resolving to Real Data

## Problem Found

The `WhatsAppChatTab` component supports placeholder resolution via props (`companyName`, `jobTitle`, `recruiterName`), **but these props are never passed** from `CandidateProfileSheet`. Only `candidateId`, `jobId`, `phoneNumber`, and `candidateName` are provided.

This means when a template with placeholders like `{{candidate.first_name}}`, `{{company.name}}`, `{{job.title}}` is sent, the actual WhatsApp message the candidate receives will contain generic fallbacks:

| Placeholder | Expected | Actually sent |
|---|---|---|
| candidate_name | "John Smith" | "John Smith" (works) |
| company_name | "Acme Corp" | "our company" |
| job_title | "Senior Engineer" | "the position" |
| recruiter_name | "Sarah Jones" | "Our team" |

## Fix

### 1. Pass missing props from `CandidateProfileSheet`

The parent component already has access to:
- **`jobTitle`** — available from the job data already loaded in the component
- **`companyName`** — available from tenant/workspace context or job data
- **`recruiterName`** — available from the current user's profile

Wire these into the `<WhatsAppChatTab>` call at line ~1724.

### 2. Add fallback data fetching inside `WhatsAppChatTab`

As a safety net, if props are still missing, the component should fetch:
- Company name from the tenant/workspace
- Job title from the job record
- Recruiter name from the current user's profile

This ensures placeholders always resolve to real data regardless of how the component is mounted.

## Files to change

| File | Change |
|---|---|
| `src/components/candidates/CandidateProfileSheet.tsx` | Pass `companyName`, `jobTitle`, `recruiterName` props to `WhatsAppChatTab` |
| `src/components/candidates/WhatsAppChatTab.tsx` | Add internal data fetching as fallback when props are not provided |

