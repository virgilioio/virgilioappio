## Goal
Match the job wizard / add-candidate sheet exactly by reusing the existing `CandidateSheetSection` primitive for every right-pane section of the Scorecard sheet. Pull titles out of the white cards. Stop wrapping per-point rows in a cream tile. Stop tinting the Key takeaways editor. Aesthetic-only.

## Source of truth (already in the codebase — do not reinvent)

`src/components/candidates/form/CandidateSheetSection.tsx`:
- Uppercase Poppins 11.5/600, tracking 0.06em, `text-virgilio-text` label **outside** the card.
- Optional `rightMeta` + `action` on the same row.
- Card: `rounded-xl ring-1 ring-virgilio-border/60 bg-white p-6 space-y-5`.
- `bare` prop renders children without the card chrome.

The job wizard and Add/Edit candidate sheets use this exact component. The Scorecard sheet must do the same.

## Changes

### 1. Replace `FormSectionCard` usage with `CandidateSheetSection`
In `src/components/candidates/ScorecardSheet.tsx`:

- Swap the import `FormSectionCard` → `CandidateSheetSection` (from `@/components/candidates/form/CandidateSheetSection`).
- Map props: `title` → `label`, `subtitle` → drop (this primitive is title-only, matching the wizard), `action` → `action`.
- Apply to: **Overall rating**, **Interview questions** sections.
- For **Key takeaways**, also use `CandidateSheetSection` with `action={<Polish notes button>}`, and pass the editor via `bare` so the rich-text-editor renders without an extra inner card (or keep the card wrapper — match whichever the wizard uses; I will mirror the wizard's rich-text pattern verbatim once I open it in build mode).

### 2. Update `KeyTakeawaysCard.tsx`
Switch from `FormSectionCard` to `CandidateSheetSection`. Keep the "Polish notes" ghost-purple button in the `action` slot. Ensure the `RichTextEditor` root is white (no cream/lilac wrapper); rely on the section card's white surface.

### 3. Rebuild `GioPointsInbox.tsx` chrome to match
Stop using the `Collapsible` as the card itself. Instead:

- Outer: `<CandidateSheetSection label="POINTS TO VALIDATE" action={<chip + chevron toggle>}>`.
- Inside the white card body, render the list directly. Each pending row:
  - Plain white background (no `bg-[#FAFAF7]`, no `border-[#F1F0EC]` wrapper).
  - Rows separated by a top hairline `border-t border-virgilio-border/60` (skip on first row).
  - Keep the 26px lilac `#EDE4FF` sparkles tile, question, rationale, priority chip, stage arrow, Dismiss + Add to scorecard buttons.
- Subtitle copy ("Gio flagged these from the résumé and job description…") is dropped to match the wizard's label-only pattern. If the user wants the helper line, it can live as the first muted line inside the card; default plan: drop it for consistency.
- When collapsed, the section renders only the label row (use the section's `bare` mode with the header rendered manually, or conditionally omit the children's card — pick whichever keeps the visual identical to other collapsible wizard sections).

### 4. Delete unused
Remove `src/components/candidates/scorecard/FormSectionCard.tsx` once it has no remaining importers. (It was a duplicate of `CandidateSheetSection` — that's the root cause of the drift.)

### 5. Verify
- All four right-pane sections (Points to validate, Overall rating, Interview questions, Key takeaways) render with the **same** uppercase label-above-card chrome as the job wizard and Add/Edit candidate sheet.
- Points to validate rows are plain white separated by hairlines; lilac sparkles tile stays.
- Key takeaways editor surface is white.
- AI suggested rating card (lilac, between Points to validate and Overall rating) and pane split (53/47) remain unchanged.

## Non-goals
- No new tokens, fonts, or color values.
- No backend, data, or behavior changes.
- No edits to the AI suggested rating card or rating pills.
