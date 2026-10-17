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
6. **Edge Functions: verify after merging, deploy by hand when needed.** A push to `main` sometimes redeploys every function a few minutes later (2026-10-16 20:43; 2026-10-17 16:51 and 17:31), but not always (the 17:38 push didn't). After merging, compare the live files with `main` (`get_edge_function`, then diff); if they differ, deploy with `deploy_edge_function` (all the function's files plus `deno.json`, same `verify_jwt` as `config.toml`) and compare again. Done this way for sign-session v12.

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

- **Gio Sign x offers, step 1: every offer field usable** (`20261017171933_sign_offer_fields`, test 18: 21/21; test 16 still 20/20):
  - Values print as words for every field type (number, link, phone, score, file), in SQL (`sign_offer_display`) and the app (`offerValues.ts`).
  - Optional offer fields print blank instead of blocking a send (`sign_optional_keys`; preview `missing` vs `blank`).
  - A yes/no field can print a tick (`sign_fields.data_style = 'tick'`, Show as a tick on the Fields step).
  - Long values wrap in their box with their own line breaks (`_shared/sign/wrap.ts`, used by `stamp.ts` and, imported as is, by `DataFieldText` in the send preview and the signing page).
  - Coverage: "N of M offer fields placed. Not placed: ..." on the Fields step and the template card.
  - New offer form field names always fit agreements (`offerFieldName`).

## Open work, in Allan's order

**Gio Sign × offers**
- **Phase 3 — write documents in Gio. Built 2026-10-17** (needs a real test from Allan: write a template, send it to yourself).
  - Database: `20261017180441_sign_written_docs` (test 19, 28/28). `sign_written_docs` holds Lexical JSON for templates and frozen copies on envelopes. Node types (a contract between editor and server): `placeholder` (placeholderKey), `gio-if` (key, op yes/no/filled/empty/equals/not_equals, value; values used only inside never block a send), `gio-sign` (roleId, kind signature/initials/date/name), `gio-page-break`. `sign_template_keys()` is the one list of values a template fills in. `sign_claim_due` holds an envelope until every written copy has its PDF.
  - Server: `_shared/sign/writtenLayout.ts` (pure layout, shared with the app and unit-tested) + `written.ts` (pdf-lib, Helvetica, Letter, 1in margins, page numbers). `sign-dispatch` v11 renders pending copies before claiming (`_shared/sign/writtenDispatch.ts`: in order, stored at `{tenant}/envelopes/{env}/written-{id}.pdf`, `sign_attach_render` shifts later pages and turns blocks into fields; failures go to `sign_render_failed`, retried up to 5 times, then a bell to the sender). `sign-written-preview` v1 (JWT) returns the same PDF for the editor and the send sheet. Both hand-deployed and checked against git.
  - App: `src/lib/sign/written.ts` (model, order across uploaded + written, preview), `src/components/sign/written/` (editor sheet, nodes). Documents step: "Write a document"; Fields step says there's nothing to place when every document is written; the send sheet's preview draws written documents filled in.
  - Known gaps: (1) the database still counts a signing block inside a section as the signer's signature (the editor keeps blocks out of sections and the wizard refuses it, so only a hand-made template could do it; tighten `sign_save_template` with the next Sign migration). (2) An envelope whose written document fails 5 times stays queued; the minute job keeps calling sign-dispatch for it (cheap, nothing happens) until the sender voids it. (3) Letters the standard PDF font lacks (Polish, Czech...) print without their accent; a Unicode font would need fontkit. (4) The template's standard "Job title" and an offer form's "Job Title" both show in the field list.
- **Phase 4.**
  - Void & resend for out-of-date offers. This needs `'offer_changed'` added to the `sign_events_kind_check` constraint, which takes a `drop`, so it is a desktop-applied migration.
  - Import from Word into the Gio editor, rather than keeping Word layout.
  - Polish "Other agreement".
  - Retire the old offer letter generator.
  - Wrap long text on uploaded PDFs in `_shared/sign/stamp.ts`.
- Allan's choice: build with the existing ATS design; he'll say if he wants changes.
- Fixed 2026-10-17: renaming an offer form field's label no longer renames its stored name (`OfferFormFieldsManager.handleUpdateField`).

**Send for signature: `TemplateSelect` (Allan, 2026-10-17, design attached in chat; plan shown, waiting for go)**
- Replaces only the template list in `SendSheet`'s Template section with a searchable dropdown; everything else in the sheet stays.
- Files: `src/components/sign/TemplateSelect.tsx` (field, panel, `TemplateStatus`); helpers `sourceLabel`, `sourceIcon`, `templatePages`, `subline`, `coverage` next to `offerCoverage` in `src/lib/sign/templates.ts`; CSS under `.tsel-*` in `src/index.css`; `useSendTemplates` (`src/lib/sign/send.ts`) also loads each template's data fields, written content and role kinds so the helpers can work.
- Mapped onto the ATS (design values → existing rules): `Pill` → `Badge` (red / neutral); `Icon` → Lucide imports; `--muted` → `text-text-secondary`, `--tertiary` → `text-text-tertiary`, `--noir` → `#0d0d09`, `--ok` → the existing success green, `--line2` → `#F0EFEA`; panel motion uses `--dur-menu-in/out` + `--ease-out` (same 180/120ms); the text swap uses the existing blur-swap timing (220ms `--ease-out`).
- Written pages are counted with the shared layout (`writtenLayout.ts`) measured in Helvetica in the browser, so the estimate matches the sent PDF.
- Esc: there's no general layer stack in the ATS; the dropdown uses the existing `data-escape-local` rule (as in `WizardSheet`), added to `FormSheet`, so Esc closes the list first and the sheet second.
- Edit template (admins only): opens the existing `TemplateWizard` stacked on its first step (where the documents are); saving refreshes the list.
- Open questions for Allan: (1) templates linked to another offer form can't be sent from an offer today (the database refuses it); the design shows them pickable. Proposed: pickable so the reason shows, Send/Preview disabled with "Linked to another offer form" when nothing else blocks. (2) "Not needed" offer fields (`skipped`) don't exist yet; it needs a column on `sign_templates` and a switch in the template editor. Proposed: build the selector with `skipped = []` now and add "not needed" as its own small database change.

**Offer approvals: tell the approvers (Allan, 2026-10-17)**
- When an offer is sent for approval, each approver whose turn it is gets an email and a bell notification ("needs your approval"), and the request shows on the Dashboard's Your queue card under Decisions.
- What exists today:
  - Nothing notifies approvers. The chain's `rules.notifyChain` and `rules.remind24h` are UI-only switches.
  - The requester's browser creates requests and approves steps with direct table writes (`useOfferApprovalRequest.ts`); no database function owns the flow.
  - `usePendingActivities.fetchPendingOfferApprovals` already returns `offer_approval` items, but `buildQueue` in `Dashboard.tsx` drops them.
  - In parallel chains it only picks up approvers at `current_step_order`.
- Plan: a database trigger on `offer_approval_request_steps` / `offer_approval_requests` queues "your turn" notifications when a step becomes active (sequential: the next step; parallel: all pending steps). An Edge Function (or the existing outbox) sends the email (`_shared/emailTemplate.ts` layout, Resend) and the bell (`emit_notification`, category `offer_event`), honouring `notifyChain`; then the Dashboard shows `offer_approval` items as Decisions ("Approve offer · Candidate · Job"), and parallel chains include every awaiting approver. Optional: `remind24h` reminders from the same job.

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
