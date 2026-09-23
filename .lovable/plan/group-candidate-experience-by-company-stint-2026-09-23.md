# Group candidate experience by company stint

## Outcome
Every profile and dossier will use the same render-time grouping rules: adjacent, continuous roles at one company become one block, while returns after another employer or a real date gap remain separate stints. Résumé file previews remain untouched.

## Implementation
1. **Create the shared experience model and grouping utility**
   - Add `src/lib/experience/groupExperience.ts` with a canonical input adapter for the existing `candidate_work_experience` rows (`job_title` → role title, `is_current` → open end date).
   - Sort newest-first before grouping, normalize company identity by ID when available and otherwise by the requested name/legal-suffix rules, then perform the positional one-pass grouping and second-pass stint/return calculations.
   - Export `groupExperience`, `formatRoleDates`, `experienceSummary`, and a union-of-date-ranges duration helper so overlapping jobs are not double-counted.
   - Because the current table has neither `company_id` nor `start_precision`, support both fields when supplied and safely fall back to normalized company name and month precision for current database rows. No schema or data changes.

2. **Build the shared profile timeline**
   - Replace the per-role profile timeline with `<ExperienceTimeline items />` using grouped company blocks, company logo/initial fallback, rails, role nesting, Current/Rejoined badges, stint metadata, wrapped long text, and role-count summary.
   - Reuse it in the independent profile Experience tab and candidate side-sheet experience sections, preserving their existing card shells and empty states.
   - Update any visible total-experience figure on these surfaces to use the shared union calculation rather than summing overlapping roles.

3. **Build the shared dossier renderer**
   - Add `<DossierExperienceGroups items scale? />` for the two-column dossier layout, shared by internal Gio Fit, suggested profiles, the public dossier, and PDF export.
   - Render grouped role dates, locations, return/stint annotations, descriptions, and existing dimension-support evidence where supplied.
   - Use `scale={0.85}` in the PDF and keep each company group as one pagination block so it cannot split across pages.
   - Add the section aside: `Digested from N roles at N companies · newest first`.

4. **Wire all requested surfaces without changing data behavior**
   - In-job Gio Fit and suggested Gio Fit continue through their shared `CandidateInsightsTab`, now using the dossier component.
   - Public dossier and PDF switch from their local per-role loops to the same dossier component.
   - Independent/in-job profile cards, tabs, and side sheets use the shared profile timeline where experience is rendered.
   - Do not alter résumé/CV viewers, parsing, persistence, duplicate handling, or APIs.

5. **Tests and verification**
   - Add unit tests for promotions, intervening-employer boomerangs, bare gaps above and below the threshold, overlaps, year precision, current/single/empty histories, legal suffixes, three-stint numbering, and returning-only `awayText`.
   - Add a test command using the project’s existing Bun toolchain, without introducing an application dependency.
   - Run the focused unit tests and inspect the profile, Gio Fit, public dossier, and print preview at desktop and 360px widths; confirm no horizontal overflow and matching grouping/order.
   - Check the latest preview build result before completion.

## Files expected to change
- Shared logic under `src/lib/experience/`
- Shared profile and dossier experience components under `src/components/candidates/`
- Existing profile, side-sheet, Gio Fit, public dossier, and PDF composition files that currently render one row per role
- PDF stylesheet for shared print sizing and no-split behavior
- Test file and package test script

## Assumptions
- Existing database dates are month-precision unless an incoming item explicitly supplies `start_precision: 'year'`; this preserves presentation-only scope despite the current table lacking that column.
- Existing `company_logo_url` is used when available; current rows have no company ID, so normalized company names are their identity fallback.
- “Years total” means the union of all valid employment intervals, so concurrent roles count once.
