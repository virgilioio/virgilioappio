

## Public job posting — width, structure, and breathing room polish

A second-pass polish to align Overview and Application tabs, expose Job Details on both tabs, widen the page, and let the content breathe (less card chrome, more whitespace) — inspired by the SiteMinder/Konfio references.

### File: `src/pages/PublicJobPosting.tsx`

#### 1. Unify tab widths and overall page width
- Main wrapper: `max-w-4xl` → `max-w-6xl` (~1152px). Still centered with healthy side margins on 1347px viewports, but uses the empty side space.
- Increase horizontal padding: `px-6` → `px-8` on desktop (`sm:px-8`).

#### 2. Same structure across both tabs (2-column with sticky Job Details sidebar)
- **Overview tab**: keep current 2-column grid `lg:grid-cols-3` (content `col-span-2` + sidebar `col-span-1`), gap stays `gap-12`.
- **Application tab**: switch from single centered `max-w-2xl` to the **same** 2-column grid as Overview. The form goes in `lg:col-span-2`; the **same `<JobDetailsCard>`** renders in `lg:col-span-1` sticky sidebar.
- Result: identical column widths, identical Job Details placement, identical scroll behavior across tabs — no jarring layout shift when switching tabs.

#### 3. Remove the card chrome around content (more "air to breathe")
- **Overview content**: drop the `<Card>`/`<CardContent>` wrapper around the About + description (lines ~619–648). Render directly on the page background. Keep the inner `space-y-6` rhythm and the subtle `border-t` separator between About and description.
- **Application form**: drop the `<Card>`/`<CardContent>` wrapper (lines ~666–667). Render the form sections directly on the page background with `space-y-12` between sections.
- Keep the **Job Details sidebar as a Card** — that's the one surface that benefits from being visually grouped (mirrors Konfio's right-rail card).

#### 4. Sidebar Job Details — slight refinement
- Soften the sidebar card: `border-border/60`, `shadow-none` (or `shadow-xs`), `rounded-xl`. Removes the heavy elevation that currently competes with the (now card-less) main content.
- Sticky offset: `lg:top-24` so it sits below the fixed header without hugging it.

#### 5. Spacing breathing room
- Title section bottom padding: `pb-8` → `pb-6` (the meta line already provides separation; tabs sit `mt-8` below).
- Tabs → content gap: `space-y-6` on Tabs root → `space-y-8`.
- Apply button on Overview: keep, but wrap in `pt-4` instead of `pt-2` for more separation from the description block.

#### 6. Application form — keep the polish from the previous pass
- Keep `space-y-12` between sections, `space-y-6` between fields, `h-11` inputs, `text-[15px]`, red `*` indicator, minimal dropzone variant — all unchanged.
- Just remove the surrounding Card and let the form sit on the page background, matching the Overview tab's now-card-less treatment.

### What does NOT change
- Tabs styling (signature pill — kept as-is).
- Brand colors, Poppins typography, `EnhancedResumeDropzone` minimal variant.
- Header polish (logo size, back link).
- In-app dashboard (zero impact — only the public page changes).

### Files touched
- `src/pages/PublicJobPosting.tsx` — widen wrapper, unify 2-col layout across both tabs, render Job Details sidebar on Application tab, drop Card wrappers around Overview content + Application form, soften sidebar card, minor spacing tweaks.

### Verification (1347px viewport)
1. Page content sits in a ~1152px column with comfortable side gutters (no longer feels narrow).
2. Switching Overview ↔ Application: column widths identical, Job Details card stays in the same right-rail spot, no layout jump.
3. Job Details (Location, Employment Type, etc.) is visible on **both** tabs as a sticky right-rail card.
4. Overview description and Application form sit directly on the page background — no enclosing card, no shadow squeezing the content.
5. Sidebar Job Details card has a light, refined border (no heavy shadow).
6. Mobile (<lg): sidebar stacks above content (Overview) / above form (Application) as before.

