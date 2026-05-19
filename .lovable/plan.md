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

## Fields & layout (form body)

Order matches the mockup; spans configurable per field via `column_span` (default 1, file/textarea = 2):

1. **Full name** (col 1) · **Email** (col 1) — Email shows tiny helper "We'll send your confirmation here."
2. **Phone** (col 1) · **LinkedIn / portfolio** (col 1)
3. **Resume / CV** (col 2) — helper "PDF or DOC, up to 10 MB". After upload renders a lilac chip with file icon, name, size, "uploaded just now", and remove (×) — uses existing `EnhancedResumeDropzone` with a new `chip` post-upload state.
4. Custom fields rendered via the existing `customFields` loop, respecting `column_span`. Yes/No appears as a pill toggle (`field_type==='checkbox'` with 2 options) shown like the "Authorized to work" pair in the mockup. Selects, textareas, dates, numbers continue to use existing renderers but restyled to the cream/white surface (height 44px, label 12.5px semibold, helper 11.5px muted).
5. **Salary expectations (optional)** — when a `salary` custom field exists, shown full-width with currency prefix chip inside the input.
6. **Why are you interested in this role?** — when a long-text custom field exists, full-width Textarea with live `XXX / 600` counter (existing state, new counter UI).

All field styling uses semantic shells (`Input`, `Textarea`, `Select`, `PhoneInput`, `DatePickerVirgilio`) with a small wrapper component `<ApplyField label helper required colSpan>` to standardize spacing.

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
