# Public Job Post — Editorial Redesign

Redesign the public job posting page (`/p/:slug`, `PublicJobPosting.tsx`) to match the new editorial layout while keeping the existing apply-form logic untouched (next iteration).

## Scope

- Redesign the **overview / job description** view only.
- Keep the existing `application` tab (form rendering, parsing, submit, confirmation dialog, RLS, throttling) exactly as-is.
- Reuse the public chrome from the Careers page (top bar, footer) for visual continuity.

## Page structure

```text
┌─────────────────────────────────────────────────────────┐
│ CareersTopBar (logo · company · nav · domain chip)      │
├─────────────────────────────────────────────────────────┤
│ Breadcrumb:  Careers › Design › Senior Product Designer │
│ Badges:     DESIGN · FEATURED                           │
│ H1:         Senior Product Designer                     │
│ Subtitle:   Design Systems                              │
│ Meta chips: Remote · Full-time · $180–220k · equity ... │
│                          Share · Save · Apply CTA       │
├──────────────────────────────┬──────────────────────────┤
│ LEFT (≈ 7 cols)              │ RIGHT (≈ 4 cols, sticky) │
│  About the role              │  Reply-in-48h pulse card │
│  What you'll do              │   + Apply CTA            │
│  You'll thrive if            │  Summary card            │
│  Nice to have                │   Posted / Location /    │
│  What we offer               │   Type / Compensation /  │
│  The process (numbered)      │   Reports to / Ref       │
│  About <Company>             │  Hiring panel (avatars)  │
│  EEO statement               │  Referral bonus card     │
├─────────────────────────────────────────────────────────┤
│ Dark CTA band — "Ready when you are." · Apply now       │
├─────────────────────────────────────────────────────────┤
│ CareersFooter                                           │
└─────────────────────────────────────────────────────────┘
```

## Data wiring (no migrations)

All content is derived from existing rows: `job_postings`, `tenants`, `careers_page_settings`, and `job_postings.details` JSONB. When a field is missing, fall back to a sensible default and hide empty sections.

| UI element | Source |
|---|---|
| Top bar / footer | `careers_page_settings` (logo, slug, website) + `tenants.name` |
| Breadcrumb dept | `details.department` |
| Badges | `details.department`, `details.featured` |
| H1 / subtitle | `posting.title` (split on em-dash `—` or `:`; fallback = whole title in H1) |
| Meta chips | `posting.location`, `details.location_type`, `posting.job_type`, salary fields, `details.equity_note`, `details.team_size`, static "Reply in <48h" |
| About the role | first paragraph of `posting.description` (sanitized) |
| What you'll do / thrive / nice / offer / process | `details.sections.responsibilities`, `qualifications`, `nice_to_haves`, `benefits`, `hiring_process` (arrays of strings); if absent fall back to splitting `posting.description` headings (best-effort) |
| Summary card | Posted = `created_at`, Location, Type, Compensation, `details.reports_to`, `details.reference_code` |
| Hiring panel | `details.hiring_panel` array `{name, role, avatar_url}` — hidden if empty |
| Referral bonus | `details.referral_bonus` `{amount, currency}` — hidden if absent |
| About company | `tenants.about` |
| EEO statement | `details.eeo_statement` or shared default copy |
| Apply CTA | switches `tab` to `'application'` and scrolls to `#application-form` (existing behavior) |

No new DB columns. Editor UI to author the new `details.sections.*` and `details.hiring_panel` is **out of scope** — already-saved postings render with graceful fallbacks.

## New components

Under `src/components/careers/public/job/`:

- `JobHeader.tsx` — breadcrumb, badges, H1+subtitle, meta chip row, share/save/apply actions.
- `JobMetaChip.tsx` — small icon + label chip used in the meta row.
- `JobBodySection.tsx` — generic titled section with bullet list or rich HTML.
- `JobProcessList.tsx` — numbered step list (purple circle + title + helper text).
- `JobAsideReplyCard.tsx` — lilac pulse "Reply in <48 hours" + Apply CTA.
- `JobAsideSummary.tsx` — definition list (label left / value right).
- `JobAsideHiringPanel.tsx` — avatar rows.
- `JobAsideReferral.tsx` — "Know someone great?" + Copy referral link button (writes `${origin}/p/${slug}?ref=...` to clipboard).
- `JobCTABand.tsx` — dark "Ready when you are." band with Apply button.

## Styling

- Cream background `#FAF7F2` (page) / white cards with `border-black/5` and `rounded-2xl`.
- H1: Instrument Serif italic accent allowed, Poppins semibold base, ~48–56px desktop.
- Body: Inter 15px, `#3f4451`; section H2: Poppins 16/600.
- Lilac accents `#EDE4FF` / `#6F3FF5` for badges, pulse card, and process numerals.
- Dark accents `#0d0d09` / `#FFFCF9` for primary CTAs, CTA band, and footer (matches Careers page).
- Right column sticky at `top-24` on `lg+`; collapses below the body on mobile.
- Two-column grid at `lg+` (`grid-cols-12` with `lg:col-span-7` + `lg:col-span-5`); single column below.

## Preserved behavior

- Route `/p/:slug` and canonical `app.gogio.io` host redirect.
- `useEffect` data loading, tenant/careers lookup, custom field fetch + select options.
- `tab` state (`overview` ↔ `application`) and `#application-form` scroll target.
- `EnhancedResumeDropzone`, `CoreFieldsRenderer`, `ApplicationFieldsRenderer`, file validation, throttling, `ApplicationConfirmationDialog`, all submit logic.
- All toasts, error states, loading spinner.

## Out of scope (next steps)

- Redesigning the **application form** (next iteration, per user).
- Admin UI to edit `details.sections.*`, `details.hiring_panel`, `details.referral_bonus`, `details.reports_to`, `details.reference_code`, `details.team_size`, `details.equity_note`, `details.eeo_statement`.
- Real referral tracking (v1 = clipboard copy of slug URL with `?ref=public`).
- Share dialog (v1 = `navigator.share` if available, else copy link).
- Save-for-later (v1 = client-side `localStorage` flag, no auth).

## Files touched

- `src/pages/PublicJobPosting.tsx` — replace `overview` tab markup, keep `application` tab untouched.
- `src/components/careers/public/job/*` — new components listed above.
