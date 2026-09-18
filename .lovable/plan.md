# Gio Fit output language selector

## Goal
Separate automatic source-language detection from the language Gio writes in. Recruiters choose the output language; detection is reported only. Rewriting prose must never change any score, weight, confidence value, evidence decision, or source record.

## Data model and resolution
- Add `organizations.default_output_language text not null default 'en'`.
- Add nullable `jobs.output_language` now, without adding job UI, so the resolver already supports the future middle tier.
- Add nullable `job_candidate_associations.output_language`; `null` always means inherit and existing rows remain null.
- Add `job_candidate_associations.ai_fit_output_language` to record the language of the currently stored dossier.
- Persist the association’s `keep_proper_nouns` preference, defaulting on.
- Resolve `association override → job override → organization default → en` inside the fit function, not in the browser.
- Validate the eight supported ISO 639-1 codes (`en`, `es`, `pt`, `fr`, `de`, `it`, `nl`, `pl`) with database validation triggers and server-side allowlists.
- Keep existing row-level access rules; no new table is needed.

## Score-safe generation
- Keep the existing scoring prompt, cross-language comparison rules, tool schema numbers, score post-processing, source keys, and evidence selection unchanged.
- Produce the canonical scored analysis first. For non-English output, run a second structured language pass over prose only.
- Translate the dossier/profile summary presentation, executive summary, dimension verdicts and insights, matches, gaps, and validation-point question/reason/stage.
- After translation, overwrite every numeric and invariant field from the canonical result: overall score, dimension scores, weights/order, confidence, priorities, source keys, and detected-language data. Language therefore cannot influence scoring.
- With “Keep names and titles as written” enabled, preserve company, institution, certification, product, and job-title strings exactly as supplied.
- Detect language per source actually read by the analysis. Store `detected_languages.summary`, confidence, and source rows inside `ai_fit_analysis`; labels must be derived from the same tracked sources as `data_sources_used`.
- Keep all automatic generation entry points compatible by resolving language inside the function.

## Dossier language control
- Add the 28px language chip immediately left of Refresh: `{resolved language} · mixed source` or `· from {detected summary}`.
- Build the specified 344px right-aligned popover using the existing popover, badge, switch, and button primitives:
  1. Read-only “Detected in the source” rows with source label, ISO code, language name, and the automatic-detection footnote.
  2. “Gio writes in” with Workspace default first, source languages promoted beneath it with `in source` badges, then the remaining supported languages alphabetically.
  3. “Keep names and titles as written,” on by default.
  4. Footer with disabled `Applied` or primary `Re-write` when pending choices differ from the applied dossier.
- Selecting Workspace default writes `null`; explicit language choices write the ISO code.
- Mark a dossier stale when `ai_fit_output_language` differs from the newly resolved language, including after a workspace-default change.
- Applying saves the choices, closes the popover, and regenerates. Keep the prior dossier visible at 40% opacity with the existing indeterminate Gio sweep; on failure restore it unchanged and show the real error inline.

## Provenance
- Add the Summary-aside provenance chip when any detected source language differs from the applied output language.
- Copy exactly: `Written in {output} from {distinct source languages} sources`; render nothing when all source languages agree with the output.
- Structure this as a reusable dossier element so the later public dossier uses the same provenance display.

## Settings
- Add a Gio content setting under Settings → Recruiting using the existing settings-card/select anatomy.
- Label it “Generate candidate content in” with the supplied explanatory copy.
- Bind it to `organizations.default_output_language` and restrict editing to the existing workspace owner/admin permissions.
- A default change affects future generations and refreshes only; no bulk regeneration.

## Verification
- Run a regression test for one association in English and another supported language; assert byte-identical overall score, dimension scores/order/weights, confidence, source keys, evidence membership, and priorities.
- Verify inheritance remains null, workspace-default changes affect only inheriting candidates, explicit overrides remain stable, and the dormant job tier resolves correctly.
- Verify mixed-source ordering/badges, Escape/outside close, proper-noun preservation, stale-dossier state, loading opacity/sweep, and failure recovery.
- Verify Settings permissions, narrow and desktop layouts, type checks, preview build, and the deployed `analyze-candidate-fit` function with a real request.
