# Redesign Create & Edit Posting sheets

Rebuild `PostingSheet.tsx` to match the new mockups. One component handles both create and edit modes — header, footer, AI affordances, and a few helper chips swap by mode. **All existing functionality is preserved**: every field currently saved (`title`, `description`, `details.*`, `publish_to_talent`, slug, application form via `PostingFieldsBuilder`) keeps its wiring; new fields are additive in `details` JSONB.

## Layout

Replace the current tabs with one long-scroll sheet (≈1040px max). Sticky header, sticky footer, sections stacked between them — same visual language as the Setup tab.

```text
┌─ Sheet (right, max-w-[1040px]) ──────────────────────────────┐
│ Sticky header (white)                                        │
│  NEW POSTING · {JOB TITLE}   or   EDIT POSTING · {JOB TITLE} │
│  {Posting title or "Untitled posting"}  [Live|Draft][Primary]│
│  Subtitle (2 lines, muted)                                   │
│                                                              │
│ Scroll area (bg #FAFAF7, gap-6, p-6):                        │
│  1. POSTING BASICS         [Pulled from job info]            │
│  2. PUBLIC DESCRIPTION     new: [Gio will draft][Draft from  │
│                             job]   edit: [Gio rewrote][Rewrite]│
│  3. BRANDING               [Inherits from workspace]         │
│  4. APPLICATION FORM       [+ Add question]                  │
│  5. WHERE TO PUBLISH       [↗ Manage integrations]           │
│  6. APPLY EXPERIENCE                                         │
│  7. SEO & SHARING          new: [Will auto-generate]         │
│                                                              │
│ Sticky footer (white, top hairline)                          │
│  Cancel · "Posting to N channels · application form M fields"│
│  edit: [Preview posting] [Save changes]                      │
│  new:  [Preview posting] [Save as draft] [Publish posting]   │
└──────────────────────────────────────────────────────────────┘
```

Each section: caps eyebrow title (10.5px Inter +0.06em muted) + right-side helper chip, then a white rounded-xl card (`border-virgilio-border`, `p-6`) containing the controls.

## Sections & field wiring

| # | Section | Fields | Storage |
|---|---|---|---|
| 1 | **Posting basics** | Public job title*, URL slug* (prefixed `/jobs/`, auto on new), Reference ID (auto on new), Posting language (Select w/ flag glyph), Application deadline (`DatePickerVirgilio`, "No deadline"/"Open until filled"), toggle **Show in public job search**, toggle **Show 'apply within 24h response' badge** | `title`, `slug`, `details.reference_id`, `details.language`, `details.deadline`, `details.show_in_search`, `details.show_24h_badge` |
| 2 | **Public description** | Posting copy* (`RichTextEditor`, markdown), inline Gio CTA in editor bottom-right ("Generate with Gio" / "Rewrite"). Edit mode: lilac **Inclusion score** sub-banner with "Suggestions →". | `description` (existing) |
| 3 | **Branding** | Hero banner (upload/replace, preview, 1600×480 hint, fallback "Using workspace default cover"), Brand color (swatch picker + hex input + "From workspace" pill), toggle **Show team photos on posting**, toggle **Embed culture video** | `details.branding.{hero_url, brand_color, show_team_photos, embed_video}` |
| 4 | **Application form** | Helper line "What candidates fill in to apply. Drag to reorder…", then `<CoreFieldsPreview />` + `<PostingFieldsBuilder postingId>` exactly as today. EEO toggle row pinned at bottom (Demographic survey). In **create** mode before save: shows a muted "Save the draft to start adding custom questions" notice with builder disabled (same gating as the current tab). | unchanged + `details.eeo_enabled` |
| 5 | **Where to publish** | Stack of channel rows. Each row: 36×36 brand glyph tile + name + meta line + right-side status (Always on / Connected · $X / $129 / 30 days / Not connected / Free · auto) + `<Switch>`. Channels: Acme Talent careers page (always on, lilac "Recommended"), LinkedIn, Welcome to the Jungle, ZipRecruiter, Google for Jobs, Indeed (free tier). Dark **Posting total** summary bar at the bottom ("$X + N sourcing credit" / "$0 (Careers page only)") with right-side lilac chip "N free, M paid". | `publish_to_talent` (existing, wired to careers/talent toggle), `details.channels[code]={enabled, cost}` |
| 6 | **Apply experience** | Toggles: **Send confirmation email** (helper: "From {sender} · 'We received your application…'"), **Promise first response in 48h**, **Allow candidate to message recruiter**, **Enable referral link** (helper shows `acmetalent.gio.com/r/{ref}`) | `details.apply.{confirmation_email, promise_48h, allow_message, referral_enabled}` |
| 7 | **SEO & sharing** | Meta title (placeholder "Auto-generates from public title", 60 char hint), Meta description (textarea, 155 char hint, "Auto-generates from public description"). On new mode show eyebrow chip "Will auto-generate". | `details.seo.{meta_title, meta_description}` |

## Behavior differences: New vs Edit

- **Header eyebrow:** `NEW POSTING · {JOB}` vs `EDIT POSTING · {JOB}` (lilac caps).
- **Title block:** "Untitled posting" + Draft badge (new); actual title + Live/Draft + Primary badges (edit).
- **Slug / Reference ID:** placeholder text in new (`auto-generated from title`, `auto-generated`); editable values in edit. Slug still computed by `generateSlug` on save when left blank (existing behavior).
- **Public description placeholder:** "Click 'Draft from job' to generate from the job information" (new) vs current copy (edit). Buttons swap: `Generate with Gio` / `Draft from job` (new) vs `Rewrite` / `Gio rewrote` chip (edit).
- **Branding banner:** "Using workspace default cover" placeholder + Upload (new) vs uploaded asset + Replace (edit).
- **Footer actions:**
  - New: `Cancel` · `Preview posting` (disabled until title valid) · `Save as draft` (creates row, `is_active=false`) · `Publish posting` (creates row, `is_active=true`).
  - Edit: `Cancel` · `Preview posting` · `Save changes`.
- **Footer summary chip:** live count of enabled channels + application form field count.

## Visual / tokens

- Section eyebrow caps: 10.5px Inter +0.06em, `text-text-tertiary`. Right-side helper chip = lilac `bg-[#EDE4FF] text-virgilio-purple` 11.5px with sparkle icon (reuse unified AI banner tone) — also used for "Pulled from job info", "Inherits from workspace", "Will auto-generate", "Gio rewrote", "Gio will draft", "Recommended".
- Cards: `bg-surface-primary rounded-xl border-virgilio-border p-6`.
- Inputs 44h, Selects 32h, ring `virgilio-purple` (existing tokens).
- Toggle rows: 2-line layout — title 13.5px Poppins 500 + helper 12.5px `text-text-secondary` left, `<Switch>` right, separated by hairline `border-b border-virgilio-border/60`.
- Badges: reuse `<Badge tone>` — Live = green dot, Draft = neutral dot, Primary = lilac, Required = yellow pill, Optional = neutral pill.
- Dark posting-total bar: `bg-[#0d0d09] text-[#FFFCF9]` rounded-xl, lightning bolt glyph left, lilac chip right.
- Sticky footer: white, top hairline. Primary submit (Save / Publish) = plain `<Button>` per Forms core rule. Preview = `variant="secondary"`. Cancel = `variant="ghost"`.

## Preserved functionality (non-negotiable)

- `useJobPostings` `getPosting / createPosting / updatePosting` remain the source of truth — no new hooks for posting CRUD.
- All current `details` keys (`location`, `employment_type`, `location_type`, `salary_*`, `commissions_*`) keep saving. They are not visible in the new mockups, so they move into a collapsible "Compensation & location" subsection inside **Posting basics** (closed by default) — values continue to be persisted exactly as today, no data loss.
- `publish_to_talent` continues to toggle from section 5 (the Acme Talent / careers row).
- `PostingFieldsBuilder` + `CoreFieldsPreview` rendered unchanged.
- About-company card and Talent.com integration alert keep their existing logic; About card moves into the Branding section (collapsible).

## Files

- `src/components/jobs/postings/PostingSheet.tsx` — full rewrite, one component, both modes via `postingId` presence.
- `src/components/jobs/postings/PostingChannelsCard.tsx` — new, channels list + dark total bar.
- `src/components/jobs/postings/PostingBrandingCard.tsx` — new, banner + brand color swatches + toggles.
- No DB migrations. No changes to `PostingFieldsBuilder`, `useJobPostings`, or `JobPostingsTab`.

## Out of scope

- Real cross-posting to LinkedIn / WTJ / ZipRecruiter / Google for Jobs / Indeed (UI + persisted toggles only).
- File upload pipeline for Hero banner (UI shell + URL field this pass; existing storage bucket wiring later).
- Real Gio rewrite / inclusion score logic (buttons wired to existing draft flow only; copy/labels updated, score uses static placeholder until backend lands).
- Real referral-link generation (URL preview only).
