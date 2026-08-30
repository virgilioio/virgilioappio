# Pipelines and candidate profiles failing to load

## What is actually happening

This is not a front-end bug. The Supabase database itself is not answering right now, so every screen that fetches data (pipelines, candidate profiles) fails or hangs.

Verified in this session:

- The app build is clean and there are no captured browser console/runtime errors.
- Postgres logs are a continuous stream of `canceling statement due to statement timeout` and `connection to client lost` (FATAL), timestamped in the last few minutes.
- The `generate-jobs-sitemap` edge function logged a Cloudflare **522 Connection timed out** from `etrxjxstjfcozdjumfsj.supabase.co` at 01:35 UTC.
- A direct read via the SQL tool returned `SUPABASE_POOLER_UNAVAILABLE` (connection timeout).
- Direct REST calls from here: the gateway answers unauthenticated requests instantly (401), but any real query hangs and dies at 20s with no response.

So the API gateway is up and the Postgres instance behind it is saturated/unresponsive. Until that clears, no code change can make pipelines load.

## Step 1 — Get the database breathing again (outside the codebase)

In the Supabase dashboard for project `etrxjxstjfcozdjumfsj`:

1. Check Reports → Database for CPU, memory, disk IO and connection count. A pegged CPU or exhausted IO budget explains the 522s and the statement timeouts.
2. Check disk usage — a full or nearly full disk causes exactly this pattern.
3. If the instance is stuck rather than merely busy, restart the project (Settings → General → Restart), then re-test.
4. If CPU/IO is simply at its ceiling under normal traffic, the compute add-on needs to be sized up; the query load below is beyond what a micro/small instance sustains.

I will re-run the health probe and the slow-query report after that to confirm recovery, and confirm the pipeline board and candidate profile load.

## Step 2 — Cut the load the app puts on the database

The slow-query report shows the app is a large part of the pressure. Highest-impact items, in order:

1. **`candidates` full-row reads.** `select *` / 30-column reads filtered by `organization_id = ANY(...)` ordered by `created_at`: 12,502 calls, 703 ms mean, 7.2 s max, ~8.8 minutes of total DB time — the single worst statement, and it sits directly under the pipeline and candidate list screens (`src/lib/candidateHelpers.ts`, `src/hooks/useCandidates.ts`). Narrow these to the columns the UI actually renders and stop the unbounded variants.
2. **`onboarding_progress` polling.** 6,046,759 calls. `useOnboardingProgress` (`src/hooks/useOnboardingProgress.ts`) has no `staleTime`, so it refetches on every mount/focus across the app. Give it a long `staleTime` and disable refetch-on-focus.
3. **Index audit.** Once the DB answers again, run `EXPLAIN (ANALYZE, BUFFERS)` on the top offenders and add the missing composite indexes — candidate targets: `candidates(organization_id, created_at desc)`, `candidates(tenant_id, deleted_at, created_at desc)`, `candidates(tenant_id, lower(email))`, `email_logs(direction, is_read, received_at desc)`, `stage_automations(is_active)`. Each added via a migration, then re-EXPLAINed to confirm the index is used.
4. **Duplicate per-row lookups.** `organizations.tenant_id` by id (178k calls) and `job_candidate_associations.booking_link_sent_at` by id (135k calls) are per-row fetches that should be folded into their parent query or cached in React Query rather than fired one-per-card.

## Step 3 — Make the failure visible instead of silent

Pipelines currently sit on a spinner when a fetch times out. Add an explicit error state with a Retry action on the pipeline board and the candidate profile, so an outage reads as "couldn't load, retry" rather than an app that hangs.

## Notes

- No schema or permission changes are needed for the diagnosis; step 2's indexes are additive migrations only.
- The reference-check answer renderer shipped just before this report is not implicated: the failures are network-level timeouts across all tables, not a render error.
