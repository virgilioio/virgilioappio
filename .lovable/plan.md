# Public Careers Index — Redesign

Redesign `/c/:companySlug` (`PublicCareersPage.tsx`) to match mockup `40_Careers_index_public`. Editorial hero, stat cards, grouped role list, "How we hire" card, open-application CTA, footer. Fully public, mobile-responsive, reads existing data — no schema changes required for v1.

## Page structure

```text
┌─ Top bar ────────────────────────────────────────────┐
│ [logo] Company · Careers          (domain chip) →    │
├─ Hero (2-col on desktop) ────────────────────────────┤
│ "We're hiring · N roles across D depts"              │
│ H1 editorial title + italic phrase + purple period   │
│ Subhead paragraph                                    │
│ [See open roles ↓]  [Life at Acme · 90s ▶]           │
│                                                      │
│        ┌─ OPEN ROLES ─┐ ┌─ AVG FIRST REPLY ─┐        │
│        │     10       │ │    18h median      │       │
│        └──────────────┘ └────────────────────┘       │
│        ┌─ Dark perks band ────────────────────┐      │
│        │ 🌐 Remote-first, offices NYC & Berlin │      │
│        └───────────────────────────────────────┘      │
├─ Filter toolbar ─────────────────────────────────────┤
│ [🔍 Search] [Dept ▾] [Location ▾] [Type ▾]  Sorted ▾ │
├─ Roles grouped by department ────────────────────────┤
│ Design · 2 open roles                                │
│ ─ Senior Product Designer [FEATURED]  📍 …  Full-time│
│ ─ Senior Product Designer (EU)        📍 …  Full-time│
│ Engineering · 4 open roles                           │
│ …                                                    │
├─ "How we hire" card (text + 4 gradient tiles) ───────┤
├─ Dark "Don't see your role?" CTA band ───────────────┤
└─ Footer (logo · tagline · 3 col links · powered by) ─┘
```

## Data wiring (v1, no migration)

| Section | Source |
|---|---|
| Logo, page_title, header_text, company_website_url, company_slug, show_company_name | `careers_page_settings` (existing) |
| Open roles count + departments count | derived from active `job_postings` for this tenant |
| Hero headline / subhead / video CTA / perks band / "How we hire" copy / tiles / footer columns | hard-coded sensible defaults in v1; expose as `careers_page_settings.details.*` later |
| AVG FIRST REPLY stat | static "48h" promise text from defaults (real metric is internal) |
| Department grouping | `job_postings.details.department` if present, else "Other" |
| Location / Type pills | `job_postings.location`, `job_postings.job_type` |
| Filter options | derived from the same postings list |
| Posted date | `created_at` → relative ("2 days ago", "1 week ago") |
| FEATURED badge | `job_postings.details.featured === true` |
| "View role" link | `/p/:postingSlug` (existing) |

Client-side search + filters (no DB round-trips). One query: existing `careers_page_settings` + active postings.

## Components (new, scoped under `src/components/careers/public/`)

- `CareersTopBar.tsx` — logo, company name, optional right nav, domain chip
- `CareersHero.tsx` — pill, H1 (with italic span + purple period), subhead, two CTAs, stat cards, perks band
- `CareersFilterBar.tsx` — search input + Department / Location / Type selects + sort label
- `CareersRoleGroup.tsx` + `CareersRoleRow.tsx` — grouped list with FEATURED badge, location pill, type pill, posted-ago, dark "View role →"
- `CareersHowWeHireCard.tsx` — copy + 4 gradient tiles (placeholder gradients, no images required)
- `CareersOpenApplicationBand.tsx` — dark band + button (mailto: tenant contact for v1)
- `CareersFooter.tsx` — logo, tagline, 3 link columns, "hiring powered by Gio"

`PublicCareersPage.tsx` orchestrates: fetch → filter state → render sections. Loading / error / empty states preserved.

## Styling

- Cream background `#FAF7F2`-ish via existing `bg-surface-primary` / tokens
- Editorial H1: Poppins display weight, italic accent span, `text-purple-period` for the dot (matches existing `<PageTitle>` pattern)
- Body: Inter; pills + buttons reuse `<Badge>` and `<Button variant="primary">`
- Dark bands use `bg-[#0d0d09] text-[#FFFCF9]` (matches Postings dark summary bar)
- Fully responsive: 2-col hero collapses, filter bar wraps, role rows stack on mobile

## Preserved

- Route, slug lookup, logo upload, `useCareersPageSettings`, public Supabase access pattern, footer "Powered by Gio"
- No changes to `PublicJobPosting.tsx` (next step)
- No new tables, no edge functions, no DB migrations

## Out of scope (next iterations)

- Editor UI to customize hero copy / perks / tiles / footer (will need `details` JSONB)
- Real "average first reply" metric
- Open-application form submission (v1 = mailto)
- Public job posting page redesign (next chat)
