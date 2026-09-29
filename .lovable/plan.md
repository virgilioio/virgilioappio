# Client pipeline view — public pipeline + public dossier, one workflow

## What you'll get
- **Job Setup › Client view**: a new section (after Offer approval) with the on/off switch, link copy/reset/preview, "Visible from" stage picker, card settings, dossier settings, and the fixed "Not part of the client view" list. Everything saves instantly; failures revert with a toast.
- **Pipeline board**: a "Client view is live" strip with Preview, plus eye / eye-off markers on each column header — only while sharing is on.
- **Share menus**: "Copy client pipeline link" in the job header Share menu; "Also in the client pipeline" row in the candidate's Share with client menu when their stage is shared.
- **Public board** for the client: read-only columns from the chosen stage onward, live updates, same look and header/footer as the public dossier, no locks or "hidden" wording anywhere.
- **Dossier inside the pipeline**: each card opens the same client-ready dossier as the individual link, with prev/next navigation and Request interview / Not a fit. One decision per candidate, shown on the board, the dossier link and the Activity tab ("via the client pipeline").
- **Unavailable page** when switched off or the job closes; a normal "not found" for reset or never-existing links.

## Open decision — link address
The brief uses `/p/{token}`, but `/p/...` already serves old job-post links. Proposal: use **`/cp/{token}`** and `/cp/{token}/{candidate}` so no existing job-post link breaks. (Alternative: keep `/p/` and tell tokens apart from job-post slugs by length/format — riskier.)

## Technical details
- Migration: `job_pipeline_shares` (unique `job_id`, random 22+ char token, `is_public`, `from_stage_id`, six display toggles, view count/last viewed, timestamps + update trigger). GRANTs, org-scoped RLS for workspace members, no anonymous table access. Trigger restricts `from_stage_id` to recruiting stages; stage-delete fallback to first remaining recruiting stage. Add `source` column (`dossier_link` | `pipeline_link`) to the existing decision store; per-association stable slug suffix.
- Edge function `public-pipeline` (no JWT): `board` and `dossier` actions. Board payload built server-side with only the allowed fields; counts only from shared stages. Dossier action reuses the existing client-ready serializer from `/d/:token`, applying initials/employer/scorecards toggles. Decisions go through the existing decision RPC with `source='pipeline_link'`. View counting debounced per IP+UA per 30 min; dossier-viewed activity once per candidate per 24h.
- Live updates: public page polls/refreshes on a realtime-safe signal (a broadcast channel keyed by token, emitted by a trigger), since anonymous clients cannot read associations directly.
- Client stage resolved server-side with the existing precedence (hired → offer → declined → requested → interviewing → awaiting).
- Frontend: `useJobPipelineShare` hook, `ClientViewSection` in Setup, board strip/header markers, share-menu rows, `PublicPipelinePage`, `PublicPipelineDossierPage` (reusing public dossier components and `GfDecisionDialog`), preview-as-client in a new tab.
- Verification: build, edge function calls with real tokens (board shape contains no forbidden fields, 404 vs unavailable, reset rotation), and public page screenshots.
