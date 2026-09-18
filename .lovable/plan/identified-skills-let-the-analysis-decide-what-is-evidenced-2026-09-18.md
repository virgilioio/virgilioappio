# Identified Skills · let the analysis decide what is evidenced

## The problem

The skill chips and the Skills Alignment section disagree because they use different evidence. The chips compare the job's skill list against the candidate's stored skill list as plain text; the analysis reads the summary, work history and resume. On Harsh Sampat the chips call Enterprise, B2B, E2E Sales, Prospecting and Outbound "not evidenced" while the analysis right below cites evidence for all five — and "Outbound Sales" fails to match "Outbound" because the match must be word-for-word. Cross-language cases fail too: his summary is Spanish, the job's skills are English.

MEDDICC, HubSpot, CRM, Inbound and Value Based Selling are genuine gaps, so the answer is not "mark everything evidenced" — it is to have the model rule on each required skill using the same material it already reads.

## What changes

**The analysis rules on each required skill.** Gio receives the job's skill list and returns one verdict per skill — evidenced, partly evidenced, or not evidenced — plus the short phrase it relied on and where that came from (summary, a specific role, listed skills, resume). It already reaches this conclusion internally; this only makes it explicit and per-skill. Scores, weights, dimensions and confidence are untouched.

**The chips read those verdicts.** Three groups replace today's two:
- Evidenced — direct support.
- Partly evidenced — supported by adjacent or general experience, not the named skill or tool. Enterprise and Prospecting land here for Harsh.
- Not evidenced — nothing in the file supports it.

Chips keep the job's wording (Outbound, B2B), so the list still scans against the requirement. The candidate's own phrase and its source appear in the chip's tooltip and in the export, not on the chip face. The header count becomes "5 evidenced · 2 partly · 4 not evidenced" over the same required total.

**Skills the candidate has that the job did not ask for** keep their current "Additional" group, unchanged.

**Older dossiers regenerate.** A fit analysis produced before this change has no per-skill verdicts. Opening the Gio Fit tab on such a candidate re-runs the analysis once, using the loading state already in place, then renders the new chips. This costs one AI run per candidate the first time it is opened, as agreed.

**The export follows.** The PDF's Identified Skills section shows the same three groups with the evidence phrase under each evidenced or partly evidenced skill. Client-ready output keeps the same groups; only the internal mechanics already hidden there stay hidden.

## Technical notes

- `supabase/functions/analyze-candidate-fit/index.ts`: pass the job's `must_have_skills` (falling back to `skills`) into the prompt and require a `skill_evidence` array — `{ skill, status: 'evidenced' | 'partial' | 'not_evidenced', evidence, source }` — with exactly one entry per required skill, in the job's order and using the job's spelling. Validate that shape server-side and drop malformed entries rather than guessing. The translation pass already in place must translate `evidence` only, never `skill` or `status`. Bump `ai_fit_version` to 3.
- `buildSkillGroups` in `src/components/candidates/insights/dossier/dossierData.ts`: accept an optional `skillEvidence` argument and derive the three groups from it when present; keep the existing literal comparison only for the Additional group. No silent fallback to string matching for the evidenced/not-evidenced split.
- `src/components/candidates/insights/CandidateInsightsTab.tsx`: treat a stored `ai_fit_version` below 3 (or a missing `skill_evidence`) the same way the tab already treats a missing analysis — trigger one refresh, show the existing "Preparing the Gio dossier…" state, and guard with the existing `hasTriggered` ref so route changes and refetches cannot loop it.
- `DossierPrintDocument.tsx` renders the three groups from the same helper; no second skill-grouping implementation.
- No schema change: `skill_evidence` lives inside the existing `ai_fit_analysis` JSON on `job_candidate_associations`.

## The model behind it

The analysis already runs on the strongest reasoning model in use (GPT-5.1, thinking depth "medium"), through the existing OpenAI integration — which stays as it is. Its own reading of this candidate was accurate, so the wrong chips are not a model-capability problem: the chips never consult the model. Two adjustments come with the new work, because the call now makes one judgement per required skill rather than one overall:

- Raise `reasoning_effort` from `medium` to `high` on this call only.
- Require the model to quote the phrase it relied on for every evidenced or partly evidenced skill. A verdict with no quotable evidence is stored as not evidenced, which keeps the chips anchored to the candidate's own words rather than to the model's impression.

## Out of scope

The duplicate Harsh Sampat records are a separate data issue and are not touched here.
