# Refactor Step 1 — Job picker as anchored popover

The current Step 1 renders inside a centered `Dialog`. The screenshot shows it should render as a **dropdown/popover anchored to the "Link to job" button** in the yellow banner, with a sheet-style header, inline search, grouped list, and footer CTA.

## Scope (this turn)

Only Step 1 changes. Step 2 (Stage + backfill) stays as the existing centered dialog; it opens after a job is picked in the popover.

## Behavior

- Click "Link to job" in `LinkToJobBanner` → popover opens **anchored to that button** (align `end`, sideOffset 8), width 460px.
- Popover header mirrors sheet pattern:
  - Lilac icon tile (Link2) on the left
  - Title "Link this project to a job" (Poppins 15px)
  - Description "Future collects will route into the chosen pipeline stage." (12.5px tertiary)
  - Close `X` icon-only button top-right
  - Hairline divider below header
- Search input directly under header (h-30, `Search jobs…`, autoFocus) with `esc` kbd hint on the right (uses `menu-classes` kbd style). `Esc` closes the popover.
- Body = same grouped list already built:
  - `GIO THINKS THESE MATCH · N` group (purple match chip, orange Hot ≥85)
  - `OTHER OPEN JOBS · N` group
  - Each row keeps icon tile + title + meta line + recruiter avatar on the right (avatar is new — pulled from existing `recruiterName` field if present; falls back to org initials).
  - Hover `#F1F0EC`, selected row gets the 2px purple LEFT rail (matches table selected state).
- Footer divider + row:
  - Left: muted "Can't find it?"
  - Right: ghost `+ Create new job` (still shows the "coming soon" toast — out of scope to wire creation).

When a job is selected → close popover, then open the existing Step 2 dialog (`StageStep`). On Step 2 "Back" we re-open the popover anchored to the same trigger.

## Technical

- New shared state in `LinkToJobBanner.tsx`: `popoverOpen` + `stageDialogOpen` + `pickedJob`.
- Split current `LinkToJobDialog.tsx`:
  - Extract `JobPickerStep` into a new exported `LinkToJobPopoverContent` (no Dialog wrapper), used inside `Popover` + `PopoverTrigger` (the banner's "Link to job" button).
  - Keep `StageStep` mounted inside a slimmed `LinkToJobDialog` that only handles Step 2 and receives the already-picked job as a prop.
- `LinkToJobBanner` wires:
  ```
  <Popover open onOpenChange>
    <PopoverTrigger asChild><Button>Link to job</Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} className="w-[460px] p-0">
      <LinkToJobPopoverContent ... onSelect={job => { close popover; setPickedJob(job); openStageDialog }} />
    </PopoverContent>
  </Popover>
  <LinkToJobDialog open={stageDialogOpen} job={pickedJob} onBack={()=>{ close dialog; open popover }} onConfirm={...} />
  ```
- `SourcingProjectActions.tsx` (the "Change Linked Job" / overflow entry) keeps using the centered dialog flow — it isn't anchored to a banner button. We add an `anchored?: boolean` prop to `LinkToJobDialog` defaulting to false, and only the banner path uses the new popover.

## Files

- Edit `src/components/sourcing/LinkToJobDialog.tsx` — export `LinkToJobPopoverContent`; strip Step 1 from the Dialog body so the Dialog only renders Step 2.
- Edit `src/components/sourcing/LinkToJobBanner.tsx` — wrap "Link to job" Button in `Popover`/`PopoverTrigger`, render `LinkToJobPopoverContent`, manage step-1↔step-2 hand-off.
- No backend changes. No payload contract changes.

## Out of scope

- Step 2 visual changes.
- Wiring "Create new job".
- `SourcingProjectActions` "Change linked job" flow.
