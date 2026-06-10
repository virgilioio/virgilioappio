## Goal

Add a second public careers page, mounted at `/virgilio-careers`, that looks and behaves exactly like the current tenant careers page, but only lists open jobs whose Company/Client is the **Virgilio internal organization** (`4b8e739f-2b15-487e-8d31-0a2ce765a8ef` — the one with 7 jobs; we deliberately do NOT match by name "Virgilio" because there's a duplicate org with the same name but no jobs).

The existing `/careers/:companySlug` page (used for all client postings today) stays exactly as-is.

## How it works

```text
/careers/:companySlug   →  unchanged. Shows ALL postings for that tenant.
/virgilio-careers       →  NEW. Shows only postings where job.organization_id = <Virgilio internal org id>.
```

The new page is a thin sibling of `PublicCareersPage`, reusing every existing child component (`CareersTopBar`, `CareersHero`, `CareersFilterBar`, `CareersRoleList`, `CareersHowWeHireCard`, `CareersOpenApplicationBand`, `CareersFooter`).

## Steps

1. **New page** — `src/pages/VirgilioCareersPage.tsx`
   - Constants at the top:
     ```ts
     const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'
     const VIRGILIO_TENANT_ID = '5ba7b145-f251-4b18-8900-724cb06028ab'
     ```
     (Hardcoded so the duplicate "Virgilio" org cannot be picked up accidentally.)
   - Load `careers_page_settings` where `tenant_id = VIRGILIO_TENANT_ID AND is_active = true` (for branding: logo, header text, page title, website URL).
   - Load `tenants` row for the company name fallback.
   - Load `job_postings` with `jobs!inner(status, organization_id)`, filtered by `tenant_id = VIRGILIO_TENANT_ID`, `is_active = true`, `jobs.status = 'open'`, **and** `jobs.organization_id = VIRGILIO_INTERNAL_ORG_ID`.
   - Load `departments` for the tenant (same as today) so the filter shows the workspace list.
   - Reuse the existing memos / grouping / filter logic 1:1.

2. **Route** — `src/App.tsx`
   - Lazy import `VirgilioCareersPage` and add `<Route path="/virgilio-careers" element={<VirgilioCareersPage />} />` next to the existing `/careers/:companySlug` route.

3. **No DB / RLS changes**
   - All required tables (`job_postings`, `jobs`, `tenants`, `departments`, `careers_page_settings`) already have anon SELECT access used by the existing public careers page. The new query uses the same anon key and the same access patterns.

## Safety notes

- We resolve the org by **ID**, not by name. If you ever rename the org or create another "Virgilio" duplicate, the page keeps showing the correct 7 jobs.
- If you later delete or merge the duplicate empty org, no code change is needed.
- The existing `/careers/:companySlug` page is untouched and continues to render every posting in the tenant (clients + internal).

## Out of scope

- No filter on the existing `/careers/:companySlug` to hide internal jobs (can be added later if you decide to split).
- No subdomain / custom domain routing.
- No admin UI — the dedicated page is implicit (driven by the hardcoded org id).
