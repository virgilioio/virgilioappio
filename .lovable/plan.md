

## Show tenant logo on job post + hide company name when logo is set

Two small public-facing polish items:

### 1. Public job posting — show tenant company logo (Ashby-style)

**File:** `src/pages/PublicJobPosting.tsx`

- In the data-load effect (line ~182), expand the `careers_page_settings` query to also select `logo_url` and `company_website_url`. Store both in new state: `companyLogoUrl`, `companyWebsiteUrl`.
- In the header (line ~590), replace the right-side `<GoGioLogo />` with:
  - If `companyLogoUrl` exists → render the tenant logo (`<img src={companyLogoUrl} className="max-h-7 w-auto object-contain" />`), wrapped in an anchor to `companyWebsiteUrl` (or to `/careers/{companySlug}` as fallback) when available.
  - Otherwise → keep `<GoGioLogo />` as today (graceful fallback for tenants without a custom logo).
- Footer (line ~1023–1027) stays as "Powered by GoGio" — that's the platform attribution, not the tenant brand.

Result: matches Ashby/SiteMinder reference where the tenant's brand sits at the top of the job post.

### 2. Public careers page — hide company name when a logo is uploaded

**File:** `src/pages/PublicCareersPage.tsx` (lines ~165–171)

Current behavior: the page always renders the tenant name as an H1 below the logo when the `show_company_name` setting is on, even when the logo already conveys the brand — visually redundant.

Change: only render the company name H1 when **either** of these is true:
- `settings.show_company_name === true` **AND** `!settings.logo_url` (no logo uploaded → name acts as the brand).

In other words: if a logo is present, suppress the H1 regardless of the `show_company_name` toggle. The toggle continues to control name visibility for tenants that haven't uploaded a logo yet.

No schema changes, no settings UI changes — purely a render-time rule. The existing toggle in `CareersPageTab` keeps its label; we just stop honoring it when a logo makes it redundant.

### What does NOT change
- `careers_page_settings` schema, `CareersPageTab` settings UI, or the `show_company_name` toggle behavior in storage.
- Footer "Powered by GoGio" attribution on both public pages.
- In-app dashboard, all other pages.

### Files touched
- `src/pages/PublicJobPosting.tsx` — fetch + render tenant logo in header (fallback to GoGioLogo).
- `src/pages/PublicCareersPage.tsx` — suppress company name H1 when `logo_url` is set.

### Verification
1. Open a public job post for a tenant that has uploaded a logo → header shows their logo (top-right), clickable if `company_website_url` is set.
2. Open a public job post for a tenant **without** a logo → header still shows the GoGio logo (no regression).
3. Open the careers page for a tenant with a logo → only the logo is shown (no duplicate company name below).
4. Open the careers page for a tenant without a logo, with "Show Company Name" on → company name H1 appears as today.
5. Footer on both public pages still reads "Powered by GoGio".

