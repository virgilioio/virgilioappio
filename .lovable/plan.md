## Scope

Visual-only pass on the Scorecard sheet to match Foundation (§0), Chrome (§1), Left pane (§2), Overall rating (§4), Interview questions (§5), Key takeaways (§6). **No functionality, no backend, no data-source changes.** All existing handlers, state, hooks, persistence, and writebacks stay byte-identical — only JSX wrapping, class names, copy, icons, and tokens change.

## What's currently off vs. the spec

**Chrome (§1)**
- No purple `SCORECARD` eyebrow above the title.
- Title is `Scorecard • Recruiter Screening` — should be `Recruiter Screening` (Poppins 20/600, ls −0.035em) with a lilac `.` period.
- "Draft saved" chip has no green check icon.
- Sub-line styling is inline-row, not a quiet "Name · Role" muted line under the title.
- Footer is missing the left "info · Drafts stay private until you submit." helper; primary button says "Submit Scorecard"/"Update Scorecard" instead of "Submit scorecard" + `check` icon.
- Sheet body uses default white; spec is `#FAFAF7`.
- Public/Private chip stays exactly as it is — display-only, read from `scorecardVisibility`. (Toggle lives in Configure Stage → Scorecard, not here.)

**Left pane (§2)**
- 50/50 split today. I'll go **45/55** (left/right): a hair tighter than the spec's 44/56 to give the questions+takeaways column the breathing room it actually needs at common laptop widths (1280–1440), while still keeping the résumé/application readable. Standard pattern for read-context + action-form sheets.
- Left pane has no `#FAFAF7` bg + right hairline.
- Tab row isn't a segmented pill (track `#F1F0EC`, active = white pill + soft shadow).

**Overall rating (§4)** — wrong visual model
- All four pills always filled. Spec: outline default (white, `1px #E0DDD3`, `#5A6072` text, `#8B8F9E` icon); only the **selected** pill fills.
- Fill colors wrong: currently `#FA5252` / `#FA8F8F` / `#9B7BF7` / `#6F3FF5`. Spec: `#C9554C/white` · `#E7ABA4/#7A2E27` (intentionally light) · `#C8B9F0/#3B2A6B` · `#6F3FF5/white`.
- Icons wrong (uses `Octagon` for No; spec is `x-circle`).
- No "others fade to 0.65 on selection" behavior.
- No height:46 / radius:10 commitment.

**Interview questions (§5)**
- Not wrapped as a FormSection card. Today it's a flat divider section.
- Heading copy: `Interview Questions` → `Interview questions`. No subtitle "Answer the questions configured for this stage."
- Salary sub-card already uses green-card styling; needs the spec's "Syncs to profile" badge with `refresh-cw` icon.

**Key takeaways (§6)**
- Not wrapped as a FormSection card.
- Polish-notes button is below the editor as an outline button; spec is **header action**, ghost purple with `sparkles`.
- Heading copy + subtitle don't match.

**Foundation tokens (§0)**
- Add missing scorecard-surface tokens as HSL semantic vars in `index.css` + Tailwind aliases in `tailwind.config.ts`: `#FAFAF7` sheet body, `#E7E8EE` card border, `#E0DDD3` field-inner border, `#F1F0EC` hairline / soft-fill, `#EDE4FF` lilac-fill, `#D7C5FB` lilac, `#5B21B6` deep-purple, `#F4FBF6`/`#BBE3C9` green-card.
- Convert the inline hex values in `GioPointsInbox.tsx` and `AddedFromGioBlock.tsx` to these tokens. No visual change, hygiene only.

## What I'll change

1. **Tokens** — `src/index.css`, `tailwind.config.ts`. Add the HSL vars + Tailwind aliases (`bg-sheet-body`, `border-card-hairline`, `border-field-inner`, `bg-soft-fill`, `bg-lilac-fill`, `border-lilac`, `text-deep-purple`, `bg-green-card`, `border-green-card`).

2. **New presentational components** under `src/components/candidates/scorecard/`:
   - `FormSectionCard.tsx` — white card, `border-card-hairline`, `rounded-xl`, p-4, optional header (title Poppins 15/600, optional subtitle Inter 12.5 muted, optional right-side action slot). Pure wrapper, no state.
   - `OverallRatingPills.tsx` — drop-in replacement for the inline rating RadioGroup. Same props (`value`, `onChange`, `disabled`) so the parent's state, draft-save effect, and submit validation all keep working unchanged. Renders 4 outline pills (h-[46px], rounded-[10px]); on select, selected pill fills with its spec color and the other three drop to opacity 0.65. Icons: `ThumbsDown`, `XCircle`, `ThumbsUp`, `Star`. Spec fill colors are hard-coded with comments (brand accents, not themable). Click-again-to-clear preserved (same behavior as today).
   - `KeyTakeawaysCard.tsx` — wraps the existing `RichTextEditor` instance with the same `value`/`onChange` props, moves the Polish Notes button into the card header (ghost purple, `sparkles` icon). All Polish handler logic stays in `ScorecardSheet.tsx` and is passed in as a prop.

3. **Sheet chrome edits in `ScorecardSheet.tsx`** (JSX + class names only)
   - Header: replace the `SheetTitle` block with `eyebrow + title-with-lilac-period + muted sub-line` composition.
   - Draft chip: add green `Check` icon.
   - Public/Private chip: **untouched** (display only, no click handler added).
   - Body bg → `bg-sheet-body`.
   - Pane split → `lg:w-[45%]` / `lg:w-[55%]`; left pane gets `bg-sheet-body border-r border-card-hairline`. Below `lg` falls back to existing single-column behavior.
   - Tabs row → segmented pill (track `bg-soft-fill rounded-full p-1`, active item `bg-white shadow-sm rounded-full`).
   - Footer: left helper text (`Info` icon + "Drafts stay private until you submit."); primary CTA → "Submit scorecard" + `Check` icon.

4. **Interview questions card**
   - Wrap the existing `{questions.map(renderQuestion)}` block in `FormSectionCard` with title "Interview questions" + subtitle "Answer the questions configured for this stage."
   - Inside the salary sub-card render, add the `RefreshCw` + "Syncs to profile" green badge above the input row. The existing salary input, `salary_config`, and profile-writeback logic stay untouched.

5. **Replace the rating + key-takeaways JSX**
   - Swap the inline `RadioGroup` with `<OverallRatingPills value={rating} onChange={setRating} disabled={isReadOnly} />`.
   - Swap the inline Key-takeaways block with `<KeyTakeawaysCard value={overview} onChange={setOverview} onPolish={handlePolishNotes} isPolishing={isPolishing} disabled={isReadOnly} />`.

## What is NOT changing (explicit)

- No DB schema, no migrations, no edge functions.
- No new state, no new hooks, no removed hooks.
- `handleSave`, `handlePolishNotes`, `handleSheetDismiss`, draft persistence, gio_added_questions persistence, salary writeback, validation-point resolution writes — all untouched.
- Public/Private toggle behavior — not added; chip stays display-only.
- AI Suggested Rating banner, RecommendedNextStepsDialog, status/offer/hired banners, Rejection / Onboarding tabs, Hire Summary cards, GioPointsInbox behavior, AddedFromGioBlock behavior — unchanged.

## Files touched

- `src/index.css` — add ~10 HSL tokens.
- `tailwind.config.ts` — Tailwind aliases.
- `src/components/candidates/scorecard/FormSectionCard.tsx` *(new)*
- `src/components/candidates/scorecard/OverallRatingPills.tsx` *(new)*
- `src/components/candidates/scorecard/KeyTakeawaysCard.tsx` *(new)*
- `src/components/candidates/scorecard/GioPointsInbox.tsx` — hex → tokens only.
- `src/components/candidates/scorecard/AddedFromGioBlock.tsx` — hex → tokens only.
- `src/components/candidates/ScorecardSheet.tsx` — JSX/class/copy edits only: header, footer, pane split, tabs styling, Interview-questions wrap, swap rating block, swap key-takeaways block.