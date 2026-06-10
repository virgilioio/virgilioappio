## Goal

Rebuild the hero section of the Virgilio Careers page (`/virgilio-careers`) to match the attached screenshot — and add the italic Instrument Serif treatment on one word (the screenshot doesn't show it, but per request it should match the General careers page styling).

## Approach

The current `VirgilioCareersPage` uses the shared `CareersHero` (now styled for tenant careers pages). To keep the two pages truly separate, I'll build a dedicated hero component for Virgilio rather than overloading the shared one.

**New file:** `src/components/careers/virgilio/VirgilioCareersHero.tsx`

**Wired into:** `src/pages/VirgilioCareersPage.tsx` — replace `<CareersHero …/>` with `<VirgilioCareersHero …/>` (same props it already passes: `openRolesCount`, `departmentsCount`, `onScrollToRoles`).

## Hero layout (matches screenshot)

Two-column, cream background (`#FAF7F2`), generous vertical padding.

**Left column (≈7/12):**
- **Eyebrow pill**: small purple dot + `CAREERS AT VIRGILIO · REMOTE-FIRST` in uppercase tracked caps (Poppins, ~11.5px, `#5a6072`).
- **Headline** (Poppins bold, ~68–80px desktop, tracking-[-0.04em], leading ~1.02):
  > Come build the future of *hiring*<span class="purple">.</span>
  
  The word **"hiring"** rendered italic Instrument Serif (same treatment as `worth joining` on the General careers page). Trailing period in purple (`text-purple-period`).
- **Subtext** (~15px, `#3f4451`, max-w ~xl):
  > We're a people company, building the modern way to hire. If you care about doing hiring right — fast, fair, and human — there's a seat for you here.
- **CTA row**:
  - Primary pill button (black `#0d0d09`, cream text): **See open roles** + circular white arrow chip on the right. Wired to `onScrollToRoles`.
  - Secondary pill button (cream/white border): **Why Virgilio** + arrow chip. Anchor link to `#why-virgilio` (section may not exist yet — just an in-page anchor, no error if missing).
- **Stat strip** (three inline stats, big Poppins number + small caption):
  - **Remote** — Fully distributed
  - **48h** — We always reply
  - **{departmentsCount}** Teams & growing (falls back to `11` if 0, just for visual parity? — I'll use live `departmentsCount` and label it `Team${s} & growing`).

**Right column (≈5/12):**
- Large rounded portrait card on a warm tan background block with two decorative shapes (small black circle top-left, lilac blob top-right peeking behind).
- **Portrait image**: I'll generate a friendly portrait photo (warm tan backdrop, woman smiling, similar mood to the screenshot) via `imagegen` at `src/assets/virgilio-careers-hero.jpg`. Generic, not depicting a real person.
- **Floating chip top-right**: white pill `● We're hiring` (green dot).
- **Floating card bottom-left** (white, rounded-2xl, soft shadow):
  - Small lilac circle with heart icon
  - `Every applicant` (bold) / `hears back from us`
  - Divider row: `AVG. FIRST REPLY` caps · large `48h` · green `No ghosting` badge.

All chrome uses existing tokens (`virgilio-purple`, `purple-period`, Poppins, Inter, Instrument Serif). No new global tokens.

## Out of scope

- No changes to the rest of the page (filters, role list, how-we-hire, footer).
- No changes to the General careers page or the shared `CareersHero` component.
- No DB / routing / settings changes.
- No "Why Virgilio" section content — just an anchor target placeholder for now (to be built in a later step).

## Technical notes

- New component is presentational; props mirror the slice of data Virgilio page already has.
- Portrait image generated once and imported as a static asset (ES6 import).
- Decorative shapes are pure CSS (absolutely positioned rounded divs), no extra assets.
- Italic serif word uses inline `style={{ fontFamily: 'Instrument Serif, Cormorant, Georgia, serif' }}` + `italic font-normal`, matching the General careers hero exactly.
