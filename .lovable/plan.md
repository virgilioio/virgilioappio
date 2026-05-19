# Public Job Application Form — Editorial Redesign

Redesign the **Application** tab of `PublicJobPosting.tsx` to match the new mockup (`42_Job_post_application_form`), keeping the visual language of the Careers page and Job Post overview tab. All existing submission logic, validation, file handling, throttling, and confirmation dialog stay intact — this is a UI/layout pass only.

## What changes

- The Application tab gets the same editorial two-column layout as the overview tab: form on the left, the existing aside (Reply card, Summary, Hiring Panel, Referral) on the right.
- The page header (badges, H1/subtitle, meta chips, breadcrumb) and `CareersTopBar` / `CareersFooter` stay visible above/below — so the user keeps full context when they switch into the form.
- The minimal "Job overview / Application" `TabsList` is removed in favor of a single dedicated "APPLY" eyebrow on the form card. Tab switching still happens internally; "Apply for this role" CTAs jump to `#application-form` and the Reply card aside also remains as the sticky CTA. A small "Back to overview" link returns the user to the overview tab.
- New form shell `ApplyCard` (white, `rounded-2xl`, `border-black/5`, padded ≈40px) containing:
  - APPLY eyebrow chip + small "We never share your data" lock pill (top-right).
  - H2 "Tell us about you." in Poppins (with subtle "." purple accent).
  - Lead paragraph: "{N} short questions, your resume, and a portfolio link. We'll reply within **48 hours** — every time."
  - 2-column responsive grid (`grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5`) hosting all fields.

## Fields & layout (driven by posting config)

The form is **fully dynamic** — nothing is hard-coded. Fields and their order come from:

- The active **core fields** (`useCoreFields`) → resume, name, email, phone, linkedin, etc. — whichever the workspace enabled for this posting.
- The posting's **custom fields** (`job_posting_application_fields` + `posting_field_select_options`) → already loaded into `customFields` / `options` state.

The redesign is purely a **rendering shell** around these existing sources. The mockup (name/email/phone/linkedin/resume/yes-no/notice period/salary/why) is an *example* of one configuration, not a fixed layout.

Render order:
1. Resume/CV first (if the core resume field is enabled) — full-width, with the new lilac uploaded-file chip (file icon, name, size, "uploaded just now", remove ×) replacing the dropzone after capture.
2. Remaining enabled core fields, in the order returned by `useCoreFields`, rendered through `CoreFieldsRenderer` (unchanged logic).
3. Custom fields, in `display_order`, rendered through `ApplicationFieldsRenderer` (unchanged logic, every existing `field_type` still supported: text, email, number, url, textarea, select, checkbox, checkbox_group, date, file, salary, location, phone, recruiter, employment_type, work_location, linkedin).

Layout:
- Wrap everything in a CSS grid `grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5`.
- Column span per field is taken from the existing `column_span` value on `job_posting_application_fields` (1 or 2). Core fields default to span 1 except `resume`, `profile_summary`, and any `textarea`-type custom field which default to span 2.
- Textareas show a live `value.length / maxLength` counter when the field has a `max_length` (or default 600 for the long-text "why" pattern). No new state — derived from `customFieldResponses[field.id]`.
- No field is added, removed, renamed, or reordered by this redesign — the eyebrow, title, lead paragraph, consent row, and submit footer are the only static chrome.

All restyled through a new wrapper `<ApplyField label helper required colSpan>` that wraps the existing `Input` / `Textarea` / `Select` / `PhoneInput` / `DatePickerVirgilio` controls so we don't fork `CoreFieldsRenderer` / `ApplicationFieldsRenderer` — we pass it as their `wrapper` slot (or, if simpler, post-process their `className` via a parent container). Field controls themselves stay on the existing components.

The lead-paragraph "{N} short questions" count is derived from `customFields.length` at runtime, so it always matches what's actually configured.

## Consent + footer of the form card

- Privacy consent: lilac-tinted checkbox + line "I agree to {Company}'s **candidate privacy policy** and to be contacted about this role and future fits. You can withdraw consent or request deletion anytime." (required to submit). New state `consentAccepted`; submit button disabled until checked.
- Small muted note below: "A short anonymous demographic survey will appear after submit. Optional, anonymized, and never tied to your application."
- Action row: ghost "Save as draft" link (left, uses existing `localStorage` `gio:draft-application:{slug}` — saves `coreFieldValues` + `customFieldResponses` + `consentAccepted`; restored on mount) and a dark "Submit application →" primary button (right). Submit reuses `handleSubmitApplication`.

## Aside (right column)

Reuses the same components already built for the overview tab: `JobAsideReplyCard`, `JobAsideSummary`, `JobAsideHiringPanel`, `JobAsideReferral`. On the application tab, `JobAsideReplyCard.onApply` becomes a no-op scroll-to-form-top.

## Visual tokens

Matches Job Post overview: page `#FAF7F2`, card `#FFFFFF` with `border-black/5` `rounded-2xl`, lilac accents `#EDE4FF` / `#6F3FF5`, dark CTAs `#0d0d09` / `#FFFCF9`, Poppins headings, Inter body, 13/13.5px form labels, 14/15px inputs.

## Files

- `src/pages/PublicJobPosting.tsx` — replace the `TabsContent value="application"` block with the new two-column layout; remove the top `TabsList`; add consent state and draft persistence.
- `src/components/careers/public/job/ApplyCard.tsx` — new card shell (eyebrow, title, lead, footer slot).
- `src/components/careers/public/job/ApplyField.tsx` — new field wrapper (label, helper, required marker, col-span).
- `src/components/careers/public/job/ApplyResumeChip.tsx` — new uploaded-file chip used after `EnhancedResumeDropzone` capture.
- `src/components/careers/public/job/ApplyConsentRow.tsx` — new consent checkbox + footer note.

## Out of scope

- Backend changes, schema changes, new fields in `job_posting_application_fields`.
- The post-submit demographic survey itself (only the helper line is added).
- Admin UI for editing `column_span`, helper text, or consent copy.
- The application limits banner stays as a small muted line at the top of the form, unchanged.

## Preserved

Route, data fetching, `handleSubmitApplication`, validation rules, file size/type checks, `ApplicationConfirmationDialog`, toast/violation handling, throttling, `useCoreFields`, `CoreFieldsRenderer`, `ApplicationFieldsRenderer` field types, and the overview tab.
