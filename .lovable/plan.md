# Job Dashboard narrated loader

## Goal
Replace the dashboard skeleton with an honest, request-driven briefing experience. Database-derived content appears first, announced phases reflect real server work, and the loading card becomes the finished briefing without a layout swap.

## Backend stream
- Convert `generate-job-briefing` from a buffered JSON response to authenticated SSE while preserving its RLS job-access check, deterministic detectors, cache, templates, model choice, and `job_briefings` persistence.
- Emit server-timestamped `phase` events around the real snapshot read, model-payload preparation, provider wait, and streamed write. Emit `stats` immediately after the database read and `issues` immediately after local detector evaluation.
- Add a genuine model-payload redaction/serialization pass before emitting the private-snapshot phase; remove candidate names, identifiers, contact/document content, and free-text scorecard content from what leaves Gio while retaining aggregate evidence needed for the briefing.
- Stream the OpenAI response and extract the paragraph incrementally from its structured JSON. Start `analyse` when the request is dispatched, complete it only on the first real content token, then start `write`; complete `write` only when the provider stream closes and persistence finishes.
- Emit an additive completion payload for the existing snapshot, health, ranked detector IDs, source, and timestamps so every current dashboard section keeps working. Cached matches return a cache marker and completed payload without replaying phases.
- Do not claim comparable-role counts because the current system has no comparable-role query. Receipt/detail copy will include only values measured in this request.
- Propagate explicit user cancellation to the provider request and emit useful provider, parse, persistence, and interrupted-stream errors without discarding already emitted local data or prose.

## Frontend state and rendering
- Add typed stream/event parsing and request state for announced phases, server timestamps, early stats/issues, streamed prose, cache status, completion, partial errors, and refresh cancellation.
- Delay loader visibility for 400ms. Fast and cached responses render the finished dashboard directly; uncached slower requests mount `JobDashboardBriefingLoader`.
- Build the specified briefing-card chassis, header elapsed counter, measured phase rows, active detail, indeterminate progress, reduced-motion behavior, and responsive spacing. If granular phases are unavailable, show one honest `Working…` row rather than synthesizing progress.
- During `write`, collapse completed phases into a factual receipt and render streamed prose in the final typography with only the caret changing at completion. Keep the same DOM paragraph to avoid reflow.
- Render three real tile skeletons until `stats` arrives, then reveal the actual tiles. Reveal locally derived issue cards when their event arrives, with the requested restrained stagger and no motion under reduced-motion.
- On refresh, retain the current briefing at 50% opacity until replacement prose starts. On errors or interrupted streams, preserve stats, issues, and partial prose and expose the appropriate retry/regenerate action.
- After 10 seconds in analysis, show the real slow-model message and an explicit Cancel action. No client timer will abort an AI request automatically; only user cancellation or a real provider/network failure ends it.

## Refactor boundaries
- Extract shared briefing/stat/issue presentation helpers from `JobBriefingTab` only where needed so the loading and finished states use identical visual geometry and existing downstream behavior remains intact.
- Keep Ask Gio, issue actions, candidate links, status logic, stat calculations, refresh behavior, permissions, and stored briefing shape unchanged.

## Verification
- Add focused tests for SSE framing/parsing, server timestamp duration math, cache bypass, first-token phase transition, partial-stream retention, and sub-400ms suppression.
- Verify the live authenticated dashboard for initial load and refresh, including stats-before-prose, slow analysis/cancel, network interruption, retry, narrow layout, and reduced motion.
- Run the project checks, inspect preview diagnostics, deploy the updated edge function, and confirm its stream headers/events against an authenticated request.
