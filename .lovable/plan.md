# Google for Jobs — make the toggle functional

Today the "Google for Jobs" channel toggle in the Job Wizard / Posting setup is cosmetic. This plan wires it to the three things Google actually needs: valid `JobPosting` JSON-LD on the public posting page, an indexable URL with proper meta, and a discoverable sitemap entry. Default for new postings: **ON**.

## Behavior contract

```
Toggle ON  → emit JobPosting JSON-LD on the public page
           → include canonical + og:url + robots "index,follow"
           → include the posting URL in /sitemap-jobs.xml
           → show a small "Indexable" badge in the wizard
Toggle OFF → omit JSON-LD
           → emit <meta name="robots" content="noindex,nofollow">
           → exclude from /sitemap-jobs.xml
```

Defaults: `google_jobs.enabled = true` for every new posting (free, recommended). Existing postings without the flag set are treated as ON.

## Database

Migration on `job_postings`:
- Add `syndication jsonb not null default '{"google_jobs": {"enabled": true}}'::jsonb`.
- Backfill existing rows where `details->'channels'->'google_jobs'` exists, otherwise default to enabled.
- Index: `create index on job_postings ((syndication->'google_jobs'->>'enabled')) where is_active = true;` for the sitemap query.
- RLS unchanged (already public-readable for active postings).

## Edge function: `generate-jobs-sitemap`

New public edge function (`verify_jwt = false`) that:
- Reads `?tenant=<slug>` (or host header) to scope to the careers domain.
- Selects active `job_postings` joined to `jobs` where `is_active = true` AND `syndication->'google_jobs'->>'enabled' = 'true'` AND parent `jobs.status = 'open'`.
- Returns `application/xml` `<urlset>` with `<loc>`, `<lastmod>` (`updated_at`), `<changefreq>weekly</changefreq>`.
- Cache-Control: `public, max-age=3600`.

Wire `/sitemap-jobs.xml` on each careers domain to this function (Vite rewrite + production redirect). Reference it from `public/robots.txt`:

```
Sitemap: https://app.gogio.io/sitemap-jobs.xml
```

## Frontend

**`src/lib/jobPostingJsonLd.ts`** (new) — pure mapper:
- Input: `job_postings` row + `jobs` row + tenant (org name, logo URL, careers domain).
- Output: validated `JobPosting` object with required fields (`title`, `description` HTML, `datePosted`, `validThrough` defaulting to +90d if missing, `hiringOrganization` with `@type: Organization`, `name`, `logo`, `sameAs`, `jobLocation` or remote variant, `employmentType`, `identifier`).
- Optional: `baseSalary` with `MonetaryAmount` + `QuantitativeValue` when salary range present; `directApply: false` (external apply only — Google Apply API is out of scope).
- Remote: emit `jobLocationType: "TELECOMMUTE"` + `applicantLocationRequirements` from posting country list.
- Employment type mapping: full_time→FULL_TIME, part_time→PART_TIME, contract→CONTRACTOR, internship→INTERN, temporary→TEMPORARY.

**`src/pages/PublicJobPosting.tsx`** — inject via `react-helmet-async` (install if absent, add `<HelmetProvider>` once at `main.tsx`):
- `<title>` and `<meta name="description">` from posting.
- `<link rel="canonical">` + `<meta property="og:url">` self-referencing the posting URL.
- When enabled: `<script type="application/ld+json">` with the mapped object + `<meta name="robots" content="index,follow">`.
- When disabled: `<meta name="robots" content="noindex,nofollow">` and no JSON-LD.
- Skip JSON-LD entirely when the posting is inactive, closed, or the parent job is paused/closed.

**`src/components/jobs/postings/PostingChannelsCard.tsx`** — Google for Jobs row:
- Read enabled state from `value.channels.google_jobs.enabled` (default true).
- Replace the "Free · auto" static meta with two states: "Indexable · structured data on" (on) vs "Hidden from Google" (off).
- Add a tooltip explaining what the toggle controls and what Google needs.
- Keep the toggle enabled (was previously implicit always-on); writes flow through existing `onChange`.

**`useJobPostings.createPosting`** — set `syndication: { google_jobs: { enabled: true } }` when creating.

**Wizard validation helper** (`src/components/jobs/wizard/...`) — non-blocking warning when toggle is ON but required JSON-LD fields are missing (employment type, location or remote flag, currency on salary range). Show as an inline lilac alert: "Google may skip this posting until you add …".

## Out of scope (call out to user before extending)

- `directApply: true` (requires Google Apply API integration).
- Tenant-level "always syndicate" master switch in Settings → Careers — easy to add later; deferred unless asked.
- Per-tenant `hiringOrganization.sameAs` (LinkedIn/company URLs) — emit only if already on `tenants`/`organizations`; otherwise omit.

## Technical notes

- `react-helmet-async` provider must live above the router in `src/main.tsx` so any route can inject head tags. Per the head-meta guide, remove the site-wide `<link rel="canonical">` from `index.html` once Helmet is the source of truth for canonicals.
- JSON-LD is rendered client-side; Googlebot executes JS so this is sufficient for indexing. Tell the user that LinkedIn/Slack previews still rely on `index.html`'s static og tags.
- Sitemap edge function must use anon key + RLS (active public postings are already anon-readable per existing policy), no service role needed.
- Add a small `__tests__/jobPostingJsonLd.test.ts` covering: required fields present, remote variant, salary range, missing-field handling.

## Verification

- Pull a posting URL, view-source → confirm `<script type="application/ld+json">` and Helmet-injected canonical.
- Paste the URL into Google's Rich Results Test → confirm "Job posting" detected with no errors.
- Toggle off → reload → confirm `noindex` meta and no JSON-LD.
- Hit `/sitemap-jobs.xml` → confirm only enabled, active, open postings appear.
