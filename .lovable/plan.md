# Redesign Create & Edit Posting sheets

Rebuild `PostingSheet.tsx` to match the new mockups (`07c_Edit_posting_sheet`, `07d_New_posting_sheet`). One component handles both create and edit modes — header, footer and AI affordances swap by mode. **All existing functionality is preserved**: every field currently saved (`title`, `description`, `details.*`, `publish_to_talent`, `slug`, application form via `PostingFieldsBuilder`) keeps its wiring; new fields are additive.

## Layout

Replace tabs with a single long-scroll sheet (1040px max) using grouped section cards, matching the Setup tab visual language.

```text
┌─ Sheet (right, max-w-[1040px], overflow-y-auto) ─────────────┐
│ Header                                                       │
│   EDIT POSTING · {JOB TITLE}     (lilac eyebrow)             │
│   {Posting title}  [Live|Draft] [Primary]            [X]     │
│   Subtitle (2 lines, muted)                                  │
│                                                              │
│ Section cards (stacked, gap-6):                              │
│   1. Posting basics        [Pulled from job info chip]       │
│   2. Public description    [Gio rewrote / Draft from job]    │
│   3. Application form      [Add question]                    │
│   4. Where to publish      (channels)                        │
│   5. Apply experience                                        │
│   6. Branding              [Inherits from workspace]         │
│   7. SEO & social card                                       │
│                                                              │
│ Sticky footer                                                │
│   Cancel · "Posting to N channels · application form M fields"│
│   Edit:   [Preview posting] [Save changes]                   │
│   New:    [Preview posting] [Save as draft] [Publish posting]│
└──────────────────────────────────────────────────────────────┘
```

## Sections & field wiring

All persisted to `job_postings` row or `details` JSONB (no schema migration required — JSONB keys are added as needed). Application form continues to use `PostingFieldsBuilder` exactly as today.

| # | Section | Fields | Storage |
|---|---|---|---|
| 1 | Posting basics | Public job title*, URL slug*, Reference ID, Posting language, Application deadline, Show in public job search, Show '24h response' badge | `title`, `slug`, `details.reference_id`, `details.language`, `details.deadline`, `details.show_in_search`, `details.show_24h_badge` |
| 2 | Public description | Posting copy* (RichTextEditor, markdown), Gio actions: "Generate with Gio" (new) / "Rewrite" (edit). "Gio will draft / Gio rewrote" status chip | `description` (existing) |
| 3 | Application form | Renders `<CoreFieldsPreview />` + `<PostingFieldsBuilder postingId>` exactly as today. In **create** mode shows inline notice "Save the draft to start adding custom questions" and disables until `localId` exists (same gating as current tab). | unchanged |
| 4 | Where to publish | Toggle list of channels: Acme Talent careers page (always on), LinkedIn, Welcome to the Jungle, ZipRecruiter, Google for Jobs. Each row shows connection state + "Manage integrations" link. Existing `publish_to_talent` keeps wiring; other channels stored under `details.channels[code] = { enabled }` | `publish_to_talent`, `details.channels` |
| 5 | Apply experience | Send confirmation email, Allow candidate to message recruiter, Enable referral link | `details.apply.*` |
| 6 | Branding | Brand color (swatches + hex), Hero banner (upload / "Using workspace default cover"), Embed culture video (url), Show team photos on posting | `details.branding.*` |
| 7 | SEO & social card | Meta title (auto from title), Meta description (auto from description), Social card preview (read-only render) | `details.seo.*` |

## Behavior differences: New vs Edit

- **Header eyebrow**: `NEW POSTING · {JOB TITLE}` (new) vs `EDIT POSTING · {JOB TITLE}` (edit).
- **Title display**: "Untitled posting" + Draft badge until typed (new); actual title + Live/Draft + Primary badges (edit).
- **AI affordances**: "Generate with Gio" / "Draft from job" / "Gio will draft" (new) vs "Rewrite" / "Gio rewrote" (edit).
- **Slug & Reference ID** show `auto-generated` placeholders in new mode (computed by `generateSlug` on save, same as today).
- **Footer actions**:
  - New: `Cancel` · `Preview posting` (disabled until valid) · `Save as draft` (sets `is_active=false`) · `Publish posting` (sets `is_active=true`).
  - Edit: `Cancel` · `Preview posting` · `Save changes`.
- **Footer summary chip**: live count of enabled channels and application form fields.

## Visual / tokens

- Section cards: `bg-surface-primary` rounded-xl, `border-virgilio-border`, `p-6`, eyebrow caps 10.5px tracking-wider muted.
- "Pulled from job info" / "Gio rewrote" / "Inherits from workspace": lilac `bg-[#EDE4FF]` pill, 12px Inter, sparkle icon — reuse the unified-AI-banner tone (small variant).
- Live = green dot Badge, Primary = lilac Badge, Draft = neutral Badge — reuse `<Badge tone>` from style-guide §3.
- Toggle rows use `<Switch>`; helper text 12.5px `text-text-secondary`.
- Sticky footer: white, top hairline border, `<Button>` primary for the right-most action (Save / Publish), `variant="secondary"` for Preview, `variant="ghost"` for Cancel.

## Preserved functionality (non-negotiable)

- `useJobPostings` `getPosting / createPosting / updatePosting` calls remain the source of truth.
- All existing `details` keys (`location`, `employment_type`, `location_type`, salary fields, commissions) keep saving — they move under a collapsible "Compensation & location" subsection inside **Posting basics** if not in the new mockups, so no data is lost. (Will confirm with you before hiding any.)
- `publish_to_talent` still toggled in section 4.
- `PostingFieldsBuilder` + `CoreFieldsPreview` unchanged.
- About-company card and Talent.com integration alert continue to render with their existing logic.

## Files

- `src/components/jobs/postings/PostingSheet.tsx` — full rewrite, single component handling both modes via `postingId` presence.
- New helper `src/components/jobs/postings/PostingChannelsCard.tsx` for the channels list (keeps PostingSheet manageable).
- No DB migrations. No changes to `PostingFieldsBuilder`, `useJobPostings`, or `JobPostingsTab`.

## Out of scope

- Real cross-posting to LinkedIn / WTJ / ZipRecruiter / Google for Jobs (UI + persisted toggles only, integration wiring later).
- File upload pipeline for Hero banner (UI + URL field only this pass).
- Gio AI generation logic for description (button wired to existing flow only; copy/labels updated).
