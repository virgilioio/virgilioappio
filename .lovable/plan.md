# Gio Fit dossier presentation and client-ready mode

## Goal
Finish and ship sections 1–5 as a presentation-only milestone. The existing analysis generation, persistence, scoring payload, refresh behavior, and PDF path remain unchanged. Language controls, sharing, public pages, and their database work are a later milestone.

## Build
- Keep **Gio Fit** between Overview and Scorecards, preserve deep links, and keep the header **GIO FIT** pill as the tab shortcut.
- Refine the dossier masthead into the specified two-column document layout: identity first, right-aligned score seal, hairline divider, and one compact action row.
- Add the **Internal / Client-ready** segmented view control. Keep Refresh and Export PDF in the same row; do not add nonfunctional language or sharing controls in this milestone.
- Keep the dossier as one sheet with Summary, Identified skills, Experience, and Education separated by hairlines.
- Preserve payload-order dimensions and payload weights, collapsed single-open behavior, null handling, evidence, and visible score-reconciliation warning.
- Make client-ready mode actually remove salary, weights, points, weighted totals, rubric mechanics, validation priorities, and salary-related validation questions while retaining score, band, confidence, evidence, skills, and experience.
- Relabel client validation as **Still to verify** and prevent mechanical validation wording from reaching that view.
- Remove any remaining superseded fit rendering/components so the analysis appears only in the dedicated tab.

## Existing-data rules
- Continue using `must_have_skills`, falling back to `skills`; never query the nonexistent `required_skills` field.
- Render only location in masthead metadata because the current candidate schema has no language, work-authorisation, availability, visa, notice, or relocation fields.
- Omit rank and median because the current fit payload has no candidate-comparison source.
- Omit internal-promotion counts unless they can be derived unambiguously from consecutive loaded experience entries at the same company.
- Keep validation points read-only because the existing add-to-scorecard flow requires an open scorecard and stage context.
- Keep data-source chips and version/update metadata only where they do not break the single-row masthead action layout.

## Verification
- Verify desktop at 1440px and a narrow viewport: no overlap, hero actions remain one row at desktop, and the 400px rail collapses cleanly when narrow.
- Verify the Overview tab contains no fit analysis, the pill opens Gio Fit, and `?tab=fit` deep-links correctly.
- Verify Internal and Client-ready behavior, collapsed/single-open dimensions, null dimensions, and score reconciliation.
- Confirm the build is clean and the diff contains no migrations or files under `supabase/`.

## Deferred milestone
Sections 6–7 require schema, prompt, settings, triggers, anonymous policies, notifications, and a public route. They will be planned and implemented after this presentation milestone is shipped.
