# Gio Fit dossier tab

## Goal
Move the existing candidate fit analysis out of Overview into a dedicated, deep-linkable **Gio Fit** tab between Overview and Scorecards. Re-present only data already loaded by the profile and `useCandidateFitInsights`; keep analysis generation, persistence, and refresh behavior unchanged.

## UI changes
- Add the `fit` tab, URL handling, and hero-pill navigation; relabel the unchanged pill geometry from **AI FIT** to **GIO FIT**.
- Replace the current fit presentation with one dossier component containing:
  - masthead, score seal, source chips, existing refresh action, and existing profile PDF action;
  - summary, computed experience stats, identified skills, experience, and education sections;
  - a 400px analysis rail with single-open dimension rows, payload weights/order, weighted contribution footer, and read-only validation points.
- Preserve automatic generation when no analysis exists and the job description is sufficient, plus the existing short-description state.
- Remove the old fit block from Overview and remove superseded fit UI components so the same analysis is not rendered twice.

## Existing-data rules
- Expand the profile's existing job read to include `skills` and `must_have_skills`; use `must_have_skills` first and `skills` as fallback.
- Read candidate identity, location, current role/company, profile summary, skills, work authorization, and languages only when present on the already-loaded candidate row.
- Derive experience stats only from loaded work-experience rows. Omit totals that cannot be computed; detect senior tenure from titles and team size only from explicit description text.
- Normalize skill comparison for case, punctuation, whitespace, and simple singular/plural differences. Label unmatched strings **not evidenced**, never missing.
- Split the executive summary into two callouts only when an explicit strongest-signal / biggest-risk seam is present; otherwise show the original full paragraph.
- Recompute the displayed weighted mean from scored dimensions only, while retaining the stored Gio Fit score as the canonical seal value.

## Deliberate omissions
- Omit candidate availability unless an actual candidate-record field is present at runtime.
- Omit the masthead metadata items and experience statistics individually when their source value is absent.
- Keep validation points read-only and omit **Add all to scorecard**: the existing scorecard path is coupled to an open scorecard, stage, persistence hook, and form-local state, so wiring a bulk action here would create a second behavior path.

## Technical scope
- React/TypeScript presentation files only.
- No migrations, table changes, edge-function edits, analysis response changes, or new data fields.
- Use the existing Button and Badge primitives and existing semantic tokens where available; add dossier-specific semantic tokens in global CSS only if the exact approved palette has no token.
- Verify the preview at desktop and narrow widths, tab deep-linking, pill navigation, refresh state, collapsed dimensions, single-open behavior, null dimensions, and absence of the old Overview fit block.
