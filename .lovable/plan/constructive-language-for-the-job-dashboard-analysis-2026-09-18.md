# Constructive language for the Job Dashboard analysis

## Goal
Keep Gio’s conclusions, evidence, priorities, and recommended actions unchanged, while presenting them as practical opportunities and next steps rather than criticism.

## Plan

1. **Give the generated briefing a constructive language contract**
   - Update the Job Dashboard briefing instructions so every response follows: factual observation → improvement opportunity → concrete proposal.
   - Require confident, advisory language without blame, alarmism, fatalistic predictions, or softened/hidden facts.
   - Keep the existing 60–90 word limit, evidence-only rule, detector ranking, structured response, and anti-hallucination constraints.

2. **Align the fixed dashboard wording with the same voice**
   - Rewrite the deterministic “Gio’s read” templates and the displayed issue-card titles/bodies with constructive phrasing.
   - Examples of the direction: “Final review is the bottleneck” becomes “Final review is the clearest opportunity to accelerate”; “The posting isn’t producing candidates” becomes “Inbound reach can be strengthened.”
   - Preserve every number, candidate reference, threshold, detector, suggested action, and urgency level.
   - Rename presentation-only labels such as “Needs attention,” “Stalled,” and “At risk” to advisory equivalents while leaving their internal statuses and severity logic unchanged.

3. **Prevent old-language briefings from remaining cached**
   - Add a briefing-language version to generated results and cache validation so existing saved briefings regenerate once under the new guidance.
   - Keep snapshot hashing, storage, refresh behavior, streaming, and dashboard data unchanged.

4. **Verify tone without reducing accuracy**
   - Test representative states: stalled final-stage candidates, low inbound volume, salary alignment, limited top-of-funnel, no recent movement, and healthy/ramping jobs.
   - Confirm the displayed and copied briefing use the same constructive wording, factual values remain identical, refresh produces the new voice, and the dashboard still streams and renders normally.

## Technical scope
- `supabase/functions/generate-job-briefing/index.ts`: generated-language guidance, fixed templates, and language-version cache invalidation.
- `src/components/jobs/JobBriefingTab.tsx`: presentation-only status, section, and evidence-card copy.
- No detector thresholds, pipeline calculations, database schema, ranking logic, recommended actions, or Ask Gio behavior will change.
