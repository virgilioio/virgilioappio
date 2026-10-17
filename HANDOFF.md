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

**Send for signature sheet, full redesign (Allan, 2026-10-17; Claude Design prompt in chat)**
- **Parts 1–5 are on main (2026-10-17).**
  - Part 1: `TemplateSelect`.
  - Part 2: shell + From the offer (`src/components/sign/send/`).
  - Part 3: Who signs, locked (`WhoSigns`, `people.ts`), the Roles step's "Comes from" choice and "Not needed" offer fields (`OfferCoverage`).
  - Part 4: the Email section is always open, and new candidate templates get the design's default message with the email-only tags `{{first_name}}`, `{{company}}` and `{{sender_first}}`.
  - Part 5: Preview as a stacked sheet (`send/PreviewSheet.tsx`), with the renderer's preview-only `highlight` option.
- Database: `20261017201301_sign_send_people` is applied (test 20, 16/16 on the live schema). It adds `sign_recipients.fill_from`, `sign_templates.offer_fields_not_needed`, `sign_role_person()`, and the email-only values in `data_snapshot`.
- `sign-written-preview` v4 is deployed. `sign-dispatch` still runs the older copy of `writtenLayout.ts`. That's fine: the only change is the preview-only option, so the next dispatch deploy can pick it up.
- Folded into the template workflow below: part 6 (Edit template round trip, "Back to {name}") and part 7 (value formats per field). Part 8, Void & resend, is still separate and applied from the desktop.
- Mappings (existing primitives win): Sheet/stacking/backdrop/Esc = ATS `SheetContent` (already 360/240ms, step-back, 12% dim); `Pill` = `Badge`; `Icon` = Lucide; buttons = ATS `Button` (sizes, press, `loading` keeps width); focus = the global 2px purple outline, not the design's noir ring; tertiary text stays `#6B7080` (contrast), not `#8B8F9E`; the collapsible = `CollapsibleContent` (`gio-accordion-content`).
- Preview: written documents shown as the real PDF from `sign-written-preview` (it's what's sent), with a preview-only option to underline values in lilac and print empty values as [Label]; uploaded pages as today's `FilledPreview`. The design's HTML "paper" (Poppins/Inter) would not match the Helvetica PDF; matching it means embedding Inter/Poppins in the PDF (fontkit), which also fixes accents.

**New / Edit template workflow (Allan, 2026-10-17; full prompt in chat). Step 0 plan shown, waiting for approval.**
- Four steps: Template info, Document (full width), Signers, Review & save. Today's wizard has five: Info, Roles, Fields, Message, Review.
- What it builds on:
  - `WizardSheet`;
  - `InfoStep`, `RolesStep`, `FieldsEditor` (uploaded pages), `WrittenEditor` + `written/nodes.tsx` (Lexical), `ReviewStep` and `TemplateCard`;
  - `coverage()` in `src/lib/sign/templates.ts`;
  - `sign_save_template`.
- Build order, one part each, with a diff after every part:
  1. Migrations and tests.
  2. Shell.
  3. Step 1.
  4. Signers.
  5. Field list, right panel and coverage.
  6. Write in Gio.
  7. Uploaded documents.
  8. Review & save, and saving.
  9. Templates page.
  10. Motion and accessibility pass.

**Offer approvals: tell the approvers (Allan, 2026-10-17). Built and live.**
- `20261017201333_offer_approval_notices` (test 21, 16/16 on the live schema):
  - triggers on requests and steps call `offer_approval_sync()`, which queues a notice and rings the bell (`emit_notification`, `offer_event`) for whoever's turn it is (sequential: the next pending step; parallel: every pending step);
  - it honours `rules.notifyChain`, and `rules.remind24h` sends one reminder a day later;
  - the outbox `offer_approval_notices` is service-role only.
- The minute job `offer-approval-notify` calls the Edge Function of the same name (v1, `x-internal-secret`) only when there's mail. It sends through Resend and skips approvers who turned offer emails off.
- Dashboard: `buildQueue` shows `offer_approval` items as Decisions ("Approve offer"). `fetchPendingOfferApprovals` includes every pending step of a parallel chain.
- Still to do: a real test, where Allan sends an offer for approval to someone else and checks the email, the bell and Your queue.

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
