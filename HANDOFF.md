# Handoff — where the work stands (2026-10-17)

Read this first in a new Claude session. It covers the three Gio projects, how Allan works, and what is open. `CLAUDE.md` in each repo holds the standing rules and wins where the two differ.

## The projects

| Project | Repo | Supabase project | Notes |
|---|---|---|---|
| Gio ATS | `virgilioio/virgilioappio` | `etrxjxstjfcozdjumfsj` | Vite, React 18, React Router 6, Tailwind 3, shadcn/Radix, TanStack Query. Rules: `CLAUDE.md` (Motion & Feel) + `AGENTS.md` (architecture). |
| Gio Sales | `virgilioio/gio-sales-hub` | `wfpxtjivdcivayghvilw` | Internal CRM. Supabase is the only backend. Rules: its `CLAUDE.md`. |
| Gio Docs | `virgilioio/giodocs` | `fzbsautaxfuqnjkchske` | Internal wiki ("Notion killer"). |

All three are merged to `main` as of this note. Lovable syncs from GitHub.

## How Allan works

- Allan is a non-technical founder. Claude is the architect and sequencer: it plans, builds in the repo, tests, and explains in plain words. He prefers a recommendation with its reasons over a list of options.
- "Go!" / "Do it!" / "Yes, go ahead" = start now. "Apply!" = apply the database change that is written and tested. "DO NOT DO ANY CHANGES" / "don't do anything" = read-only.
- Never print a secret or token. If Allan pastes one, tell him to rotate it.
- "Don't delete anyone, I'll do that manually": never delete people or records on his behalf.
- No mock data in the product. Tests use fake data intercepted in the browser, never written to the database.

## How a change ships

1. **Database first.** Write the migration in `supabase/migrations/`, plus a test in `supabase/tests/NN_name.sql` that writes its results to a temp table `t_results (check_name, ok)`.
2. **Dry run.** Run the migration and the test in one transaction that never commits. The reliable way through the Supabase connector: `begin;` + migration + test, then end with `do $x$ begin raise exception 'RESULTS %', (select string_agg(check_name||'='||ok, ' | ') from t_results); end $x$;`. The error carries the results and rolls everything back. Afterwards, confirm nothing was left behind.
3. **Stop for review.** Tell Allan what it does in plain words and wait for "Apply!".
4. **Apply** with `apply_migration`, using the file's contents exactly. Then:
   - Check the function bodies in `pg_proc` against the file (md5 of `prosrc`).
   - `git mv` the file to the version the database recorded.
   - Regenerate `src/integrations/supabase/types.ts` in the same commit.
   - Run the test again the rolled-back way.
5. **Merge:** feature branch → push → fast-forward `main` → push.

Hard limits:
- Migrations and tests must not contain the whole words `delete`, `drop` or `truncate`. The connector cancels those from a cloud chat. When one is needed, write the file and give Allan a one-paragraph message to apply it from a desktop chat with a folder added.
- Edge Function files are ASCII only.
- Commits end with the attribution lines the session gives.
- Every branch is pushed with an upstream.
- UI follows `CLAUDE.md` Motion & Feel: use the primitives in its Implementation map, never per-component animation classes.
- Before Allan tests, verify UI in a real browser (Playwright, Chromium preinstalled) with fake data. The dev server is `npx vite --port 8091 --strictPort --host 127.0.0.1`.

## Done today (2026-10-17, ATS)

- **Quiet scheduled jobs** (`quiet_cron`): cron jobs only call Edge Functions when there is work. Allan emptied `net._http_response` (283 MB → 32 kB).
- **Faster Candidates table and startup:** parallel loading (`src/lib/parallel.ts`), one shared startup (`useAuthBootstrap`), a cached profile. First rows 4.5 s → 2.6 s; revisits 4.9 s → 0.2 s; startup requests 62 → 37.
- **Resume replace status:** `useResumeRefresh` + `ResumeStatusLine` show upload → Gio reading → Gio Fit re-scoring in the Resume card and the sidebar file row.
- **Gio Sign × offers, phases 1–2** (`sign_offer_values`, `sign_offer_send`). Agreements are filled from the offer form, never showing raw JSON. One send rule, `offer_can_send()`: with no approval chain an offer is sendable at once; with a chain, only once every step is approved. Templates link to an offer form (`sign_templates.offer_form_id`). The send sheet groups templates, offers "From the offer" and shows a filled-in preview (`FilledPreview`). Each envelope records its offer and a fingerprint of the values it used, and is flagged `out_of_date` when those values change. The offer's status follows its envelope. Mark hired waits for a sent offer to be signed. Test 16: 20/20 on the live database.

- **Resume reading checks** (`_shared/resumeFacts.ts`, `enrich-candidate-profile` v315 deployed): Gio reads the name off the resume and leaves the profile untouched when it names someone else (`enrichment_status = 'other_person'`, shown in the Resume status line); a job is kept only when its company appears in the resume text (dropped ones are logged as `[enrich] Dropped`); the same job listed twice is saved once. The 33 doubled jobs (27 profiles) were all written in one insert, i.e. the model repeated them, not a race.

## Open work, in Allan's order

**Gio Sign × offers**
- **Phase 3 — write documents in Gio.** A Lexical editor for templates; the server makes the PDF with pdf-lib; written and uploaded documents in one envelope; conditional sections; a coverage check (every offer field placed somewhere); a line about it on the templates page.
- **Phase 4.**
  - Void & resend for out-of-date offers. This needs `'offer_changed'` added to the `sign_events_kind_check` constraint, which takes a `drop`, so it is a desktop-applied migration.
  - Import from Word into the Gio editor, rather than keeping Word layout.
  - Polish "Other agreement".
  - Retire the old offer letter generator.
  - Wrap long text on uploaded PDFs in `_shared/sign/stamp.ts`.
- Allan's choice: build with the existing ATS design; he'll say if he wants changes.

**Speed and robustness plan (steps 1–3 done)**
- **Step 4 — database cleanup.**
  - ATS: 442 "multiple permissive policies" advisor warnings, 39 unindexed foreign keys.
  - Sales: 108 unindexed foreign keys.
  - Docs: not yet checked.
  - Read the advisors, propose, then wait for "Apply!".
- **Step 5 — public links.** Rate limits, timeouts and retries on booking, careers, reference and signing pages, and on the Edge Functions they call.

**Data and security**
- Cleanup of existing profiles: the doubled jobs are done (`20261017170617_dedupe_work_history`, 21 profiles, 21 rows; Apollo collect now saves each job once, `enrich-apollo-profile` v374). Left as they are: 6 Coresignal profiles whose repeated jobs have an unknown company (probably different jobs). Still open: about 112 profiles with work history that isn't in their resume; it needs a read-only pass over the resume files, since the text isn't stored. Give Allan the list first; never change profiles without his OK. Watch the `[enrich] Dropped` logs for real jobs dropped because the model rewrote a company name. `enrich-by-linkedin` and `refresh-candidate-profiles` pick up the Apollo dedupe on their next deploy.
- Rotate the internal function secret, which is stored in plain text in one place. Allan does the rotation.
- Run a real end-to-end Gio Sign test (Allan as signer).
- NOM-151 (Mexican e-signature certificate), phase 2.

## Where things live (ATS)

- Sign: `src/lib/sign/` (`send.ts`, `templates.ts`, `api.ts`), `src/components/sign/` (`SendSheet`, `AgreementsCard`, `FilledPreview`, `PdfPage`, `templates/`), Edge Functions under `supabase/functions/` (`sign-*`, `_shared/sign/`).
- Offers: `src/lib/offerValues.ts` (the one formatter), `src/hooks/useOfferApprovalSummary.ts`, `src/components/candidates/status/OfferBannerSmart.tsx`.
- Reports and audits: `.lovable/reports/`.
