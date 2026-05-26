
# Make "Pick the default stage" feel like Step 2 of the same popover

Right now Step 1 (job picker) is an anchored popover under the "Link to job" button, but Step 2 (default stage + backfill) opens as a centered modal `Dialog`. That breaks the multi-step illusion. We'll move Step 2 into the **same popover**, swap the body in place, and re-skin it to match the screenshot.

## Behavior

- One `Popover` anchored to the "Link to job" button holds both steps.
- Internal `step` state (`'pick' | 'stage'`) swaps the body — no second floating surface, no dialog overlay.
- Width stays at `w-[460px]`; height grows naturally with content.
- Selecting a job in Step 1 → swap to Step 2 in place.
- Back arrow / Back button in Step 2 → swap back to Step 1, keeping the previously selected job highlighted.
- Esc and outside-click close the whole popover from either step.
- "Create new job" in Step 1 footer still opens `JobWizard` (unchanged).

## Step 2 visual treatment (to match screenshot)

Header (mirrors Step 1's sheet-style header, but with a Back action instead of a lilac icon tile):

- Square dark **Back tile**: 36×36, `rounded-lg`, `bg-foreground text-background`, `ChevronLeft` icon, acts as the back button.
- Title: job title in 15px Poppins semibold, `tracking-[-0.02em]`.
- Sub-line: `Design · 142 applicants · Maya Reyes` style — department · applicant count · recruiter name (use what's available; gracefully drop missing parts and the separators).
- Divider hairline below header (same `h-px bg-border` as Step 1).

Section: **DEFAULT STAGE FOR NEW COLLECTS**

- Section label: 10px uppercase, `tracking-[0.06em]`, `text-text-tertiary`, with horizontal padding aligned to the rows below.
- Stage rows: full-width `rounded-lg`, `px-3 py-2.5`, with:
  - Radio bullet on the left (custom, not native): 16px outer ring, virgilio-purple when selected with a filled center dot.
  - 12px **colored square** stage swatch (uses stage color if available, otherwise a neutral `bg-foreground/15`).
  - Stage name in 13.5px Inter.
  - Right-aligned **Recommended** badge on the first/default stage — `tone="lilac" size="xs" shape="pill"`.
- Selected row background: `#EDE4FF` (lilac), unselected hover: `#F1F0EC`. Matches the screenshot.

Divider, then section: **BACKFILL**

- Same 10px uppercase label.
- Two checkbox rows (only the first appears when `savedCount > 0`):
  - "Drop **N already-collected** candidates into **{stage}**" — bolded counts inline.
  - "Send **{Org} careers page** link to all future collects".
- Checkboxes are the standard shadcn `Checkbox` (already used) — keep the dark square filled look from the screenshot via existing theme.

Footer:

- Divider hairline above.
- Left side: helper text — `"{N} will move on link"` when backfill is on, else `"No backfill"` (12px tertiary).
- Right side: secondary **Back** + primary **Link project** with `Link2` icon. Use `<Button>` defaults (per project memory: primary submit = plain `<Button>` with no overrides).

## Cleanup of the old centered dialog

- `LinkToJobBanner` no longer renders `<LinkToJobDialog … pickedJob={…}>` for Step 2. The popover handles both steps end-to-end.
- The `LinkToJobDialog` legacy wrapper (used by `SourcingProjectActions` "Change linked job") stays, but its internal Step 2 is updated to the same component so both entry points look identical. We extract Step 2 into a shared `<StagePickerStep>` body and reuse it inside both surfaces (popover + legacy dialog).

## Files

- Edit `src/components/sourcing/LinkToJobDialog.tsx`
  - Extract Step 2 markup into a reusable `StagePickerStep` (no surface chrome — just the inner content).
  - Restyle header to match screenshot (square dark back tile, title + meta sub-line).
  - Restyle stage rows (radio bullet + color swatch + Recommended badge).
  - Restyle backfill section + footer per screenshot.
  - Export a new `LinkToJobStagePopoverContent` that wraps `StagePickerStep` for use inside the popover (loads stages for the picked job, owns `selectedJhsId`, `backfill`, `careersLink` state, and calls `onConfirm` / `onBack`).
- Edit `src/components/sourcing/LinkToJobBanner.tsx`
  - Replace the `pickedJob`/dialog hand-off with a single popover that swaps `<LinkToJobPopoverContent>` ↔ `<LinkToJobStagePopoverContent>` based on local `step` state.
  - Remove `stageDialogOpen` and the `<LinkToJobDialog>` render.
  - Keep `JobWizard` wiring for "Create new job" as-is.

## Out of scope

- Department/recruiter sub-line wiring: surfaced if `JobOption` already carries it; if not, we render whatever subset is present (title + applicants at minimum) and leave a follow-up to enrich the hook. No new queries in this pass.
- The legacy `LinkToJobDialog` (Change-linked-job from the project overflow) keeps its centered-dialog surface; only its inner Step 2 body adopts the new visuals via the shared component.
