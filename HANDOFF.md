# Handoff — where the work stands (2026-10-19)

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

## Done 2026-10-19 (ATS)

- **Candidate comments, mentions and tabs** (Allan's plan of 2026-10-18, all four parts on main; details in `CLAUDE.md`, Implementation map, "Candidate comments"):
  - database, applied as `20261018234855_candidate_comments_job_optional` (from Allan's desktop) and `20261018235003_candidate_comments_v2` (test 27, 17 checks). Comments are shared with everyone who can see the candidate, or private to the author; a tagged comment can't be private; a tag notifies only people who can see the candidate; a comment can sit outside any job. It also fixed comments not saving at all since May (`tg_notify_mention` read a column that doesn't exist);
  - the Comments card above Details on both profiles (`src/components/candidates/comments/`): "@" to tag a teammate, chips, the Private switch, and the reminders row under the box. The Comments tab is gone; `?tab=comments` opens Job overview / Overview;
  - Reply and Forward on every email in the Activity feed (`fetchEmailForReply`), and the duplicate Email History card is gone;
  - an Activity tab on the standalone profile (every job and the person); its Send email opens the Gio composer. The email numbers moved into the Activity sidebar's Email block, and the Emails tab is gone on both profiles; `?tab=emails` and `?tab=communications` open Activity.
- **Offer fully approved: the person who asked is told.** Applied as `20261019011108_offer_approval_complete` (test 28, 12 checks, passed on live, rolled back):
  - once the whole chain is done (request approved, no step pending or declined; skipped steps count), the requester gets one bell (`approval_complete`, with the approval sound) and one email, "The offer for X is approved", in the Gio ATS design. Nothing if they made the last approval themselves;
  - `offer_approval_announce` fires from triggers on requests and steps, so the order the browser writes them in doesn't matter; the email waits in `offer_approval_outcomes` and goes out through `offer-approval-notify` (v15).
- **The approved offer on the profile** (`CandidateOfferDetails`): the green "This offer has been approved" box is now `OfferApproved` (who approved, when, "Nothing has gone to the candidate yet"). Send for signature lives only in the dark stage banner (Allan). "Generate Offer Letter" (`GenerateOfferDialog`, `offerLetterUtils`), the old "Send Offer" email and the "Offer document generated" box are gone; PDFs made with the old generator stay in the candidate's files. The route is create offer → request approval (if any) → Send for signature → choose a template.
- **The old offer letter templates are gone from Settings** (Allan: "all that is legacy"): the Offer letters and Contracts tabs under Settings › Templates (and the job and platform defaults) and their editors. Contracts are Gio Sign's job now (Allan). Offer forms, Email templates, Rejection reasons, Rejection templates and Candidate sources stay. The saved templates stay in the database, unused.
- **The offer trail in the in-job Activity feed** (Allan: "record all activity derived from the offer"). Applied as `20261019023525_activity_offer_types` (new `activity_type` values) and `20261019024429_activity_offer_trail` (test 29, 18 checks, passed on live, rolled back). The database writes every entry now, never the browser:
  - offer created; "Offer updated" naming the changed fields (one entry per person per 15 minutes; edits right after creating it count as creating it);
  - sent for approval (approvers listed, skipped steps left out), each approval or decline with its note, recalled, and "Offer fully approved" once the chain is done;
  - Gio Sign: agreement sent (to whom), opened (first time per signer), signed (the candidate is named as who did it), declined (reason), voided (reason), expired, reminded, and completed once everyone has signed;
  - status changes (offer, hired, rejected, unhire) were already logged by `log_candidate_status_change`.
  - Older entries that only carried `metadata.jobId` (23, including "Hired · filled" from Mark hired) were hidden from the in-job feed; `activities_a_job_id` now copies it to `job_id` on every insert, and they were backfilled.
  - App: the feed's filter has an "Offer & signing" category; an external signer shows as the author (`external_actor`); `OfferComposerBody` and `useOfferApprovalRequest` no longer log from the browser.
- **Offer form sections you shape** (Allan: "default sections, but the ability to add more… nothing is hardcoded… even the defaults could be edited or even removed"). Applied as `20261019031231_offer_form_sections` (test 30, 14 checks, passed on live, rolled back):
  - `offer_forms.sections` holds each form's sections in order (`id`, `title`, `columns` 1 or 2); `offer_form_fields.section_key` places each field. New forms start with Role & start, Compensation, Benefits & conditions and Additional terms; every one can be renamed, reordered, given one or two columns or taken out, and new ones added. A removed section hands its fields to the last one left; a field added without a section goes in the last one. Existing fields went where the composer used to guess them (all 25 checked).
  - The offer composer reads the sections (`groupBySection`, `src/lib/offerSections.ts`): Req ID at the top of the first section, the Y1 total under the section holding the base salary. The always-on "Band checked" badge and the "Comp band check" note are gone (nothing checked a band).
  - New offer form sheet (`src/components/settings/offerForms/`): the name as the title with its purple period, description, Active, then the sections as recruiters meet them. Fields drag within and between sections (board motion; long press on touch) or move through their ⋯ menu; they open in place to edit. Sections rename in place; their ⋯ menu has one/two columns, move up/down and Remove (with Undo). Preview shows the Terms step. Everything saves as you go ("Saving…" → "Saved"). Only field types the composer can fill in are offered (no Dropdown or File: the composer shows both as a plain text box).
  - Toasts now stay clickable while a sheet or dialog is open (an Undo inside a sheet couldn't be clicked before), and a click on one no longer counts as clicking outside the sheet.
- **One recruiting library: who may edit it.** Applied as `20261019040505_library_editors` (test 31, 14 checks, passed on live, rolled back). `library_editor()` is a platform admin or an owner/admin of Virgilio's workspace; library editors manage the shared rows and Virgilio's own rows of pipeline stages, application fields, offer forms (with their fields and choices), email templates, rejection reasons, rejection emails and candidate sources. Before this, only platform admins could edit the shared rows and only a workspace owner (Virgilio has none) its own, so the two admins could edit neither. Other workspaces' rows stay out of reach; reading is unchanged.
- **Settings clean-up** (Allan: "I agree with everything"):
  - the Platform dashboard is gone (SaaS-era, most numbers wrong); platform admins land on the usual default tab; SaaS customers stays;
  - the application confirmation email (the only live automation in Settings › Automations) is the "When someone applies" card on Careers page (`settings/careers/ApplyConfirmationCard.tsx`); the Automations tab, its "coming soon" card and Job Defaults' copy are gone;
  - one recruiting library in Settings › Recruiting: Pipeline stages, Application form and every Templates tab are one list each (shared rows and Virgilio's own together), editable by workspace admins; Job defaults is gone (old links open Pipeline stages). The lists share `LibraryCard` (`settings/shared/LibraryCard.tsx`): skeleton, LoadError with Retry, the flag scene when empty, IconTips, row collapse. Offer forms now lists the two shared forms we use;
  - removing a stage works for admins too: applied as `20261019042407_library_stage_retire` (test 32, 5 checks, passed on live, rolled back).
- **Stage banners wrap on phones** (`StatusBanner`: offer, hired, rejected). One row from lg up; below that the buttons move to their own row and wrap as whole buttons.
- **Waiting on Allan:** a real test of the approval emails end to end (send an offer for approval to a teammate: their email, bell and Remind; then your "approved" bell, sound and email once they approve).

## Done 2026-10-18 (ATS)

- **Write in Gio takes Gio Docs' behaviour** ("Docs DNA", in the ATS's own type and colours; details in `CLAUDE.md`, Implementation map, "Offer editor, Gio Docs DNA"). All in `src/components/sign/written/` and `templates/WrittenPane.tsx`:
  - a document title and typing shortcuts (`typing.tsx`), the Docs "/" menu (`slashMenu.tsx`), block handles with + and ⋮⋮ (`blockHandles.tsx`), and the dark selection bar (`floatingToolbar.tsx`). There is no fixed toolbar any more; undo/redo are ⌘Z / ⌘⇧Z;
  - callouts (`callout.tsx`): four icons or none, five colours;
  - tables (`table.tsx`, Lexical's own): column and row menus, "+" bars, Tab in the last cell adds a row. Cells hold text, data tags and inline signer fields;
  - two columns (`columns.tsx`): exactly two, so two people can sign side by side. Sections, page breaks and nested columns stay out of a column;
  - Small text, a whole-document switch kept in the content as `gio.small`. The PDF prints the body at 9.5pt;
  - every block has a PDF counterpart in `_shared/sign/writtenLayout.ts` (unit tests in `_shared/__tests__/writtenLayout.test.ts`, 33 passing).
- **Template steps are now:** Template info · Signers · Document · Message · Review & save (`WIZARD_STEPS` / `STEP` in `src/lib/sign/templates.ts`). Message is its own step again, because folded into Template info it went unnoticed.
- **A page rail** (`PagesRail`) sits under the Summary in both Document panes, for written and uploaded documents. The Preview and the rail share one render (`writtenPreviewInput`).
- **Images were built and then removed** (Allan: "Let's not do images"). Revert `16e3ff0`. Nothing used them: no saved document and no stored file. Don't bring them back without asking.
- `sign-written-preview` and `sign-dispatch` are redeployed from `main` with this layout (v16 and v24, 2026-10-18).
- **Offer approvals: Remind really reminds.** Applied as `20261018051642_offer_approval_remind` (test 24, 14 checks):
  - `offer_approval_remind(request)` queues a reminder email and rings the bell for the approvers whose turn it is. It never reminds the person pressing it, and reminds each approver at most once an hour;
  - `offer_approval_claim_notices_v2` adds who sent the reminder, and `offer-approval-notify` (redeployed) words the email as a reminder from them;
  - every pending request was synced once, so the offer that was waiting since before the notices went live got its turn email (support@virgilio.tech, 05:17 UTC) and its bell;
  - the button (`CandidateOfferApprovals.tsx`) says who was reminded, or how long until they can be reminded again;
  - the approver sees the offer in Your queue under their own login.

- **Every email in the Gio ATS design.**
  - `_shared/atsEmail.ts` is the one layout for team and system emails: the "gio ats" logo (`public/brand/gio-ats-logo-dark.png`, drawn from `GioAtsLogo`'s paths, because Gmail and Outlook don't show SVG), the product in the masthead, an eyebrow, a title with a lilac period, a candidate card, the dark button and the Gio footer.
  - The old `createEmailTemplate` now draws this layout, which covers bookings, cancellations, calendar replies, chat notifications, invitation requests, password reset and the account confirmation email.
  - The offer approval emails and the "Interview notes ready" and dossier-decision emails were moved onto it by hand.
  - All 11 functions are deployed.
  - Left as they are: the privacy notices (Virgilio's own brand) and the reference emails (the agency's logo, by design).
- **The bell is live, and it has a sound** (`20261018231352_notifications_live`, test 25 4/4).
  - Notifications are in Realtime, so the bell updates at once.
  - "Play a sound" plays "Pebble, low, tighter" (Allan chose it in the sound lab, https://claude.ai/artifact/7EkkBu9Q5Tyq2uJ9kkA7on): two wooden taps for a mention, a run of four for an offer that needs your approval.
  - The code is in `src/lib/notificationSound.ts` and `src/hooks/useNotificationSound.ts`.

## Done 2026-10-18 (Gio Docs)

- **The black rail: Gio's look in Gio Docs.** Merged to Gio Docs `main` (e85e9a5) after Allan approved the screenshots. It was built on the branch `claude/docs-black-rail`. The rules are in Gio Docs' `AGENTS.md` ("Decisions (Allan, 2026-10-18: the black rail, Gio's DNA)").
  - The sidebar is a floating black card, like the Gio ATS and Gio Sales rails, and stays black in dark mode. The page beside it is a rounded card, as in Gio Sales.
  - Open, the card's top row has the lilac fold button, New page and the Inbox; Search sits below.
  - Folded, it is the 64px Gio rail. Favorites, Workspace and Private open their pages in a card beside the rail on hover.
  - The spacing pass tightened the page tree and every page's block spacing. It applies to existing pages too.
- **Running Gio Docs locally with fake data:**
  - Install: `bun.lock` points at Lovable's private package cache, so install with the lockfile moved aside: `BUN_CONFIG_REGISTRY=https://registry.npmjs.org bun install`, then `git checkout -- bun.lock`.
  - Run `npx vite dev --port 8093`, then use Playwright with every request to the Supabase host answered in the browser: a fake session in `localStorage`, and tables served from memory.

## Done 2026-10-17 (ATS)

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
  - Void & resend for out-of-date offers (parked by Allan, 2026-10-18). This needs `'offer_changed'` added to the `sign_events_kind_check` constraint, which takes a `drop`, so it is a desktop-applied migration.
  - Polish "Other agreement".
  - Retire the old offer letter generator. Done 2026-10-19: no Generate Offer Letter on the profile, and Settings › Templates has no Offer letters tab (removed `OfferLetterSheet`, `OfferTemplateFieldsManager`, `useOfferTemplates`, `useOfferTemplateFields`, `PlatformOfferTemplatesManager`; `PlaceholderHelper` lost its legacy-template path). The old template rows stay in the database, unused.
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
- `sign-written-preview` v5 and `sign-dispatch` v13 are deployed (2026-10-17) with the same `writtenLayout.ts`: formats, inline signer fields, the `gt0` rule, red empties in the editor's preview.
- Folded into the template workflow below: part 6 (Edit template round trip, "Back to {name}") and part 7 (value formats per field). Part 8, Void & resend, is still separate and applied from the desktop.
- Mappings (existing primitives win): Sheet/stacking/backdrop/Esc = ATS `SheetContent` (already 360/240ms, step-back, 12% dim); `Pill` = `Badge`; `Icon` = Lucide; buttons = ATS `Button` (sizes, press, `loading` keeps width); focus = the global 2px purple outline, not the design's noir ring; tertiary text stays `#6B7080` (contrast), not `#8B8F9E`; the collapsible = `CollapsibleContent` (`gio-accordion-content`).
- Preview: written documents shown as the real PDF from `sign-written-preview` (it's what's sent), with a preview-only option to underline values in lilac and print empty values as [Label]; uploaded pages as today's `FilledPreview`. The design's HTML "paper" (Poppins/Inter) would not match the Helvetica PDF; matching it means embedding Inter/Poppins in the PDF (fontkit), which also fixes accents.

**New / Edit template workflow (Allan, 2026-10-17; full prompt in chat).**
- Built as four steps (Template info, Document, Signers, Review & save); since 2026-10-18 it's five: Template info · Signers · Document · Message · Review & save. **All ten parts are built and on main (2026-10-17).**
- What it builds on:
  - `WizardSheet`;
  - `InfoStep`, `RolesStep`, `FieldsEditor` (uploaded pages), `WrittenEditor` + `written/nodes.tsx` (Lexical), `ReviewStep` and `TemplateCard`;
  - `coverage()` in `src/lib/sign/templates.ts`;
  - `sign_save_template`.
- Approved 2026-10-17 with every recommendation from the Step 0 plan:
  - keep the existing field selector;
  - use the design's new offer form selector, Documents choice, writing experience and Review & save;
  - no new tables; roles keep all five sources and Approves;
  - one written document per template;
  - unsaved changes use the inline `UnsavedGuard`.
- Part 1, the database, is applied (2026-10-17): `20261017214923_sign_template_workflow` (test 22, 22/22 on the live schema).
  - `sign_fields.data_format` and the placeholder node's `format`: money as code / symbol / words, dates three ways, numbers as a figure or in words.
  - `sign_format()`, `sign_value_variant()`, `sign_variants()` and `sign_template_uses()`. Formatted values travel as `key|format` in `values` and `data_snapshot`; placed fields freeze their own format.
  - `gio-field` nodes (inline signer fields: initials, date, name, text or checkbox, with `required` and `label`), checked on save; `sign_attach_render` keeps their kind, required flag and label.
  - A signing block inside a conditional section no longer counts as a signature (closes gap 1).
  - `sign_sample_values(form, uses)`: the editor's Preview with the latest offer on the form, for admins only.
- Where it lives: `TemplateWizard` → `InfoStep` (+ folded Default email), `DocumentStep` (tabs when both sources; `WrittenPane` for Write in Gio, `FieldsEditor` for uploaded pages; both use `FieldList` on the left and `FieldPanel` pieces on the right), `RolesStep`, `ReviewStep`. Formats: `src/lib/sign/formats.ts` (mirrors `sign_format`). Coverage: `draftCoverage()` in `templates.ts` (§7: mapped, missing, skipped, blocking, total). The old `WrittenEditor` sheet and `OfferCoverage` are gone.
- Write in Gio (as built 2026-10-17; the toolbar and the plain "/" menu were replaced by Gio Docs' "/" menu, block handles and selection bar on 2026-10-18, see above): offer chips with formats, signer field chips (`gio-field`), signature blocks (signature + date), conditional sections (rule `gt0` = "is more than 0" for money/numbers; no database check on rules), click-to-select + Delete, Preview with the latest offer on the form (`sign_sample_values`), empty values red.
- Allan's rulings (2026-10-17): click places on the page in view (not page 1), stacked; Email tile stays on uploaded pages; Signature on uploaded pages is one box; "Fills from" stays; toolbar extras (alignment, Quote) stay; no strikethrough button; the "/" menu appears instantly. From the Send sheet the editor is stacked on the sheet, so saving returns to it; no "Back to {candidate}" toast.
- **Client company** (applied 2026-10-17): `20261017235206_sign_client_company` (test 23, 8/8 on the live schema). `{{client}}` = the job's client organization (fed from Gio Sales; Virgilio for its own jobs) on candidate templates, in documents, placed fields and the email; listed under Always available. The email-only `{{company}}` (your workspace) is labelled "Your company". New candidate templates' default subject: "Your offer from {{client}} · please review and sign" (no live template used `{{company}}`).
- No Word templates (Allan, 2026-10-18): no Word {{placeholder}} mapping and no import from Word. Documents are written in Gio (Write in Gio) or uploaded as PDFs. Don't propose it again.
- Waiting on Allan: his own test of the new editor (title, "/" menu, handles, callout, table, two columns, Small text) and its PDF.

**Offer approvals: tell the approvers (Allan, 2026-10-17). Built and live.**
- `20261017201333_offer_approval_notices` (test 21, 16/16 on the live schema):
  - triggers on requests and steps call `offer_approval_sync()`, which queues a notice and rings the bell (`emit_notification`, `offer_event`) for whoever's turn it is (sequential: the next pending step; parallel: every pending step);
  - it honours `rules.notifyChain`, and `rules.remind24h` sends one reminder a day later;
  - the outbox `offer_approval_notices` is service-role only.
- The minute job `offer-approval-notify` calls the Edge Function of the same name (v1, `x-internal-secret`) only when there's mail. It sends through Resend and skips approvers who turned offer emails off.
- Dashboard: `buildQueue` shows `offer_approval` items as Decisions ("Approve offer"). `fetchPendingOfferApprovals` includes every pending step of a parallel chain.
- Remind added 2026-10-18 (see Done 2026-10-18).
- Still to do: a real test, where Allan sends an offer for approval to someone else and checks the email, the bell, Remind and Your queue.

**Settings clean-up (Allan, 2026-10-19): done, see Done 2026-10-19.** Left:
- Decide: the Job wizard's auto-reject and hiring-team notification switches are saved nowhere and do nothing; build them or hide them.
- The job and posting default triggers (`handle_new_job_defaults`, `add_default_application_fields_to_posting`) don't filter by workspace; harmless with one workspace.
- The `platform-admin-metrics` Edge Function is no longer called; Allan may remove it from the Supabase dashboard.

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
