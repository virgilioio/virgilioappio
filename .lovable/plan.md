## Plan

### 1. Fix the Button system mismatches at the source
- Change the default `<Button>` to the new `md · 34px` Gio default instead of the old 40px legacy default.
- Re-map legacy `variant="destructive"` to the documented outline `danger` style, not solid red.
- Keep `dangerSolid` as the only filled red button for final destructive confirmations.
- Replace hard-coded hover colors in the Button component with semantic token-based classes so the implementation matches the design-system rule.
- Ensure icon-only usage relies on `iconOnly` + `aria-label`, not manual `h-8 w-8 p-0` overrides.

### 2. Correct candidate profile sheet control cards
- Convert the candidate profile control-card actions to `variant="secondary" size="sm"` per the spec: `sm · 28px · 12px text` for card-internal buttons and toolbar actions.
- Specifically update:
  - Move to Offer / Return to Pipeline
  - Add / Transfer to Job
  - Edit / Download
  - Add Note / Send Email / Schedule Interview
  - Submit Scorecard / AI Notes Analysis Available
  - Schedule Interview / Move to this stage
  - Resume Replace / Upload controls where they are card-internal secondary actions
- Replace `mr-2`, manual icon sizing, and manual height/padding overrides with Button’s built-in `icon`, `iconRight`, `dropdown`, and size handling where practical.

### 3. Fix rejection and destructive actions
- Change the first-surface Reject buttons in the candidate profile and job bulk-selection toolbar to `variant="danger" size="sm"` so they render as the explicit outline Danger variant.
- Keep dialog confirmation buttons as `variant="dangerSolid"`, because those are final destructive commit steps.
- Update Cancel buttons in destructive dialogs to `secondary`/standard non-destructive styling.

### 4. Clean up related reusable candidate action components
- Update `MoveToPipelineMenu`, `AddOrTransferCandidateDialog`, `GenerateBookingLinkButton`, `RejectionDialog`, and `BulkRejectionDialog` so their triggers/footer buttons use the new variants and sizes consistently.
- Narrow any component prop types that still only allow old variants like `default | outline | ghost` so they accept the Gio variants actually needed.

### 5. Audit visible legacy usage around the candidate workflow
- Replace duplicated JobDetail toolbar button mismatches:
  - `variant="virgilio"` → `variant="purple"` only for Gio/review-style brand actions.
  - `variant="outline"` → `variant="secondary"` for ordinary toolbar actions.
  - remove manual `h-[36px]` overrides.
- Do a final `rg` audit for `variant="destructive"`, `variant="outline"`, manual `h-[36px]`, `h-8 w-8 p-0`, and `mr-2` in the touched candidate workflow files to catch remaining drift.

### Technical details
- Primary files: `src/components/ui/button.tsx`, `src/components/candidates/CandidateProfileSheet.tsx`, `src/pages/JobDetail.tsx`.
- Supporting files: `MoveToPipelineMenu.tsx`, `AddOrTransferCandidateDialog.tsx`, `GenerateBookingLinkButton.tsx`, `RejectionDialog.tsx`, `BulkRejectionDialog.tsx`, and dialog/alert-dialog button wrappers if needed.
- No business logic changes; this is a visual/design-system conformance pass only.