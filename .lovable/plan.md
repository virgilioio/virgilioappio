# Share List Modal — visual alignment with mockups

Tighten the existing `ShareListModal` so each of the 4 steps matches the reference mockups. Functionality stays. This is pure visual/UX polish.

## Differences spotted (mockup vs current)

### Global chrome (all steps)

- **Two-zone background.** Mockups have a clean white header + cream `#FAFAF7` body and footer. Current body is white. → Make body + footer cream; nest inner cards as white panels.
- **Title accent dot.** Every step title ends with a small lilac period (e.g. `Bundle these candidates·`). Currently a plain `.`. → Render the trailing `.` as a `text-virgilio-purple` glyph.
- **Header icon chip** is a slightly larger soft-lilac rounded square (~28px, rounded-lg). Current is 24px rounded-md. → Bump size, soften radius.
- **Progress bar** segments are slightly thicker and black-on-`#E8E6E0` rather than `bg-foreground / bg-black/8`. Current is close enough; just darken inactive to `#E8E6E0`.

### Step 1 — Bundle these candidates

- Candidate rows in the mockup show **avatar + name + sub-line (company · stage) + green score + ×**. Current rows show only name. → Accept richer candidate context (company, stage, fit score) from `Candidates.tsx` and render the sub-line and the green score.
- **"+ Add more"** purple link sits in the top-right of the candidates panel. → Add a non-functional-yet link (opens a placeholder picker / disabled tooltip "Coming next") to match the visual.
- Candidates panel is a white card on the cream body (already a bordered card — just confirm bg-white once body turns cream).

### Step 2 — Who's reviewing?

- **Owner row removed.** Mockup table shows only invited reviewers, not the current user. → Drop the owner row; instead show a small grey **"You're inviting"** chip next to the row for any reviewer added during this session.
- Reviewer sub-line shows **role · team** (e.g. "Hiring manager · Design", "Recruiter", "Reviewer"). → Pull `system_role` from `useTenantMembersForShare` and render it.
- Each row gets a trailing **`...` overflow** button (visual only for now; opens a small menu with "Remove" → reuse `removeReviewer`). → Add a 4th column `[1fr_180px_60px_28px]`.
- **Chips in the picker** show full name with avatar (e.g. "MR Maya Reyes ×") on white with a purple ring — not purple-tinted background. → Restyle the selected chips.
- **Internal-only banner** is a soft amber card with a small lock badge (not the current neutral cream). → Switch to `bg-[#FEF7E6] border-[#F5E3B3]` with amber lock icon and link-styled "External share" anchor.

### Step 3 — Compose the share

- **Card layout.** The whole step is one cream-toned bordered card containing link + meta + message + checkbox (mockup), not three stacked sections. → Wrap step 3 contents in a single cream panel (matches body) and use white sub-cards inside.
- **Copy button** next to the URL is a **black pill** (`variant="primary"` or solid dark), not secondary. → Swap to primary.
- **Meta row** below the URL is a **single horizontal row of 3 inline items** with icons: `👥 Invited reviewers only`, `🕐 Expires in 14 days ⌄`, `🚫 Block screenshots (off)`. Not a 3-column grid with uppercase eyebrow labels. → Replace the grid with an inline meta row; "Expires" stays a `<Select>` styled as inline link-button with chevron; "Block screenshots" toggles inline with the `(off)/(on)` suffix.
- **"Rewrite with Gio"** button sits **inside the textarea, bottom-right**, not above the label. → Position absolutely inside a relative wrapper around the `Textarea`.
- **Notify checkbox** is a square filled black checkbox (current `Checkbox` already matches when checked). Keep.

### Step 4 — Shared with N teammates

- **Big green check** in a larger white circle (h-14 w-14) with green check, not foreground. → Use `text-emerald-500` and bump the circle.
- **Recap card** leads with a small lilac square Users icon (chip), keeps name + meta, and shows the **avatar stack on the right** (already present). URL row inside the card stays.
- Helper "Find it later under **Lists → Shared by me** in the left rail." sits in its **own bordered info row** with a small `ⓘ` icon — not loose centered text.
- **Footer on step 4** shows only the two action buttons; the left "Lives in Lists sidebar from now on." text should be removed for step 4.

## Files to change

- `src/components/candidates/bulk/ShareListModal.tsx` — all visual changes above.
- `src/pages/Candidates.tsx` — pass richer candidate context to the modal (company, stage, fit score) so Step 1 rows can render sub-line + score.

No DB, hook, or API changes. No new dependencies.

## Out of scope

- Wiring "+ Add more" to a real picker.
- Wiring the row `...` menu beyond Remove.
- External share flow.
