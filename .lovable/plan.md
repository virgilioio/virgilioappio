

## Fix mobile horizontal scroll in candidate profile sheet + Pipeline Overview height on mobile job detail

### Part 1 — Candidate profile sheet horizontal scroll

**Problem.** On mobile, the **Candidate Details** card (when collapsed) renders an inline preview row with email + phone + WhatsApp + copy buttons next to the title and chevron. With a long email/phone the row exceeds the 390px viewport and forces the entire profile sheet into horizontal scroll.

**Fix — single file: `src/components/candidates/CandidateDetailsCollapsible.tsx`**

1. **Hide the inline collapsed preview on mobile.** Wrap the existing `{!open && (<div … email+phone …/>)}` block with `hidden sm:flex` so it only shows at `≥640px`. On mobile, the collapsed state shows just the title and chevron — tap to expand reveals full details.
2. **Tighten the desktop preview as a safety net** so it can never push the row wide:
   - Add `min-w-0 max-w-[60%]` to the inline preview wrapper.
   - Add `truncate` to the email span (already partially present) and wrap the phone display in `max-w-[120px] truncate`.
3. **Belt-and-suspenders on the trigger row** — add `min-w-0` to the outer trigger flex container and `truncate` to the `CardTitle`.

No behavior change when expanded — full email/phone list still renders inside `CollapsibleContent`.

### Part 2 — Pipeline Overview card too short on mobile

**Problem.** On mobile, inside a job's **Pipeline** tab, the `PipelineOverviewTable` card uses `max-h-[400px]` on its inner scroll wrapper. After the recent JobDetail mobile fix (`flex-1 min-h-0 overflow-auto` on `TabsContent`), the parent now offers full available height, but the card caps itself at 400px — which on a 390×844 viewport means the table only shows ~3 rows and the user has to scroll inside a tiny window to see the pipeline. Feels broken.

**Fix — single file: `src/components/analytics/PipelineOverviewTable.tsx`**

1. **Make the inner scroll wrapper responsive**: change
   ```tsx
   <div className="max-h-[400px] overflow-auto">
   ```
   to
   ```tsx
   <div className="max-h-[60vh] sm:max-h-[400px] overflow-auto">
   ```
   On mobile the table can grow up to 60% of viewport height (~500px on a typical phone), giving 7–8 visible rows. Desktop behavior unchanged.
2. **Let the Card itself stretch on mobile** so it fills the available `TabsContent` space rather than hugging its content: add `h-full sm:h-auto flex flex-col` to the outer `<Card>` and `flex-1 min-h-0 p-0` to the `<CardContent>` (replacing current `p-0`). Inner scroll wrapper becomes `h-full overflow-auto` on mobile via the same responsive max-height above.

No empty-state, sticky-header, totals-row, or desktop visual changes.

### Files touched
- `src/components/candidates/CandidateDetailsCollapsible.tsx`
- `src/components/analytics/PipelineOverviewTable.tsx`

### Out of scope
- Restructuring the Pipeline section selector or Card header.
- Auditing other profile-sheet cards for overflow (separate pass if reported).
- Default collapsed/expanded state on mobile (stays collapsed — matches user preference).

