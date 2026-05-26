# Remove duplicate close (X) buttons

## Context

Our base `SheetContent` (`src/components/ui/sheet.tsx`) and `DialogContent` (`src/components/ui/dialog.tsx`) **always render their own absolute-positioned close `X`** in the top-right. There's no opt-out prop. So any wrapper that also adds its own `X` close button ends up showing **two X icons**.

I audited every component that renders a `<Sheet>`/`<Dialog>` plus an `<X />` icon. Most X icons are legitimate (chip removal, clear-input, danger-zone icon, dismiss-AI-notes, file remove, etc.). Four components are true duplicates.

## Components to fix

1. **`src/components/candidates/ApolloPreviewSheet.tsx`** (line ~531-535) — header action row has a ghost button `onClick={() => onOpenChange(false)}` rendering `<X />` next to the built-in sheet X.
2. **`src/components/candidates/ApplicationReviewSheet.tsx`** (line ~178-186) — header nav row has a custom `<button onClick={handleClose}><X /></button>` next to the built-in sheet X.
3. **`src/components/jobs/JobWizard.tsx`** (line ~314-323) — top bar renders a custom `<button onClick={onClose}><X className="h-5 w-5" /></button>`; the built-in sheet X is also present.
4. **`src/components/candidates/bulk/ShareListModal.tsx`** (line ~258-262) — header right-side renders `<button onClick={() => setOpen(false)}><X /></button>`; `DialogContent` already provides one.

## Change

For each of the 4 files, delete only the custom X close button (and any now-empty wrapper). Keep all surrounding controls (Next/Prev, More menu, step counter, etc.). The built-in close X from `SheetContent`/`DialogContent` remains and continues to call `onOpenChange(false)`.

No changes to `sheet.tsx` / `dialog.tsx` primitives (intentional — the built-in X is the single source of truth).

## Not changed (verified clean / X serves a different purpose)

- `SearchResultsDialog` (clear search input), `JobFormSheet` (danger-zone decorative icon), `CandidateFormSheet` (remove pending file), `ExpandableScoreDisplay` (dismiss AI notes), `RoleInterpretationDrawer` ("Discard Changes" button), `MinimizableBulkUploadDialog` / `MinimizableEmailComposer` / `MinimizableOfferComposer` / `GlobalBulkUploadWidget` (custom floating panels, not `Sheet`/`Dialog` — X is the only close), `AttachmentPreviewDialog`, `ScheduleInterviewSheet`, `ScorecardSheet`, `CandidateProfileSheet`.

## Verification

Open each of the 4 sheets/dialogs in preview and confirm only one X is visible in the top-right and clicking it closes the surface.
