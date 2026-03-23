

# Fix LinkedIn URLs Opening as Relative Paths

## Problem

When candidates apply through public job posts and enter a LinkedIn URL like `www.linkedin.com/in/username` (without `https://`), the URL is stored as-is in the database. When clicked, the browser treats it as a relative URL, resulting in `https://app.gogio.io/jobs/www.linkedin.com/in/...`.

The `CandidateFormSheet` already normalizes LinkedIn URLs (adds `https://` if missing) when saving via the internal form, but the **public application edge function** (`public-submit-application`) does NOT normalize — it stores the raw input.

## Fix

Two layers — normalize on ingest AND on render:

### 1. Normalize on ingest: `supabase/functions/public-submit-application/index.ts`

Before storing `linkedin_url`, add the same normalization used in `CandidateFormSheet`:

```ts
let linkedinUrl = body.linkedin_url?.slice(0, 512)?.trim() || null;
if (linkedinUrl && !linkedinUrl.match(/^https?:\/\//i)) {
  linkedinUrl = `https://${linkedinUrl}`;
}
```

Apply this normalized value wherever `linkedin_url` is stored (line 240 for new candidates, line 357 for `linkedin_sync` updates).

### 2. Safe render in all LinkedIn link clicks

Create a tiny utility `ensureAbsoluteUrl(url)` and use it in the 3 places that open LinkedIn URLs:

- `CandidateProfileSheet.tsx` line 938
- `ApplicationReviewSheet.tsx` line 109
- `SourcingCandidateCard.tsx` line 113 (`href`)

This protects against existing bad data already in the database.

## Files

| File | Change |
|------|--------|
| `supabase/functions/public-submit-application/index.ts` | Normalize `linkedin_url` before storing |
| `src/lib/utils.ts` | Add `ensureAbsoluteUrl` helper |
| `src/components/candidates/CandidateProfileSheet.tsx` | Use `ensureAbsoluteUrl` on LinkedIn click |
| `src/components/candidates/ApplicationReviewSheet.tsx` | Use `ensureAbsoluteUrl` on LinkedIn click |
| `src/components/sourcing/SourcingCandidateCard.tsx` | Use `ensureAbsoluteUrl` on LinkedIn href |

