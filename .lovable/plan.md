# Rebuild the Add candidate form sheet

Restructure `CandidateFormSheet.tsx` around two independent parse states (`parseStep`, `enrich`) and a fixed 6-section order, so that Skills and Profile Summary always read as *AI-generated* (idle hint / generating card / done), never as empty fields the user must fill. Same six sections in Edit mode.

## Files touched

- `src/components/candidates/CandidateFormSheet.tsx` — section order, state machine, footer status line, save-while-enriching behavior.
- `src/components/candidates/EnhancedResumeDropzone.tsx` — three visual states (idle dashed / parsing lilac-card with spinner + indeterminate bar / done row with Replace + trash).
- `src/components/candidates/form/CandidateSheetSection.tsx` — accept right-aligned status badge slot.
- `src/components/candidates/form/AssignmentRowCard.tsx` — used as-is for Edit mode "Current assignments".
- NEW `src/components/candidates/form/GeneratingCard.tsx` — shared lilac generating shell (pulsing sparkles + "Running in background" tag + spinner) used by Skills and Profile Summary `working` state. Renders skeleton pills or skeleton lines based on a `variant` prop.
- NEW `src/components/candidates/form/SkillsSection.tsx` — three-state Skills section (idle input / working pills / done chip cloud with header count badge).
- NEW `src/components/candidates/form/ProfileSummarySection.tsx` — three-state Summary section (idle hint / working lines / done paragraph + Regenerate).
- NEW `src/components/candidates/form/ResumeStatusBadge.tsx` — right-aligned status badge for the Résumé section header.
- NEW `src/components/candidates/form/FooterStatusLine.tsx` — left-side live status line in the footer.
- `src/index.css` — add the four keyframes (`gioSpin`, `gioBar`, `gioShimmer`, `gioPulse`) and `prefers-reduced-motion` overrides. Add utility classes `.gio-spinner`, `.gio-progress`, `.gio-skeleton`, `.gio-pulse`.

No new tokens, fonts, or radii — reuse the design system already in `index.css`. No DB / RLS / edge-function changes.

## Two-state machine

```ts
type ParseStep = 'idle' | 'parsing' | 'done'   // contact + professional
type Enrich    = 'idle' | 'working' | 'done'   // skills + summary
```

Drive both from the existing resume upload + `useResumeParsing` / `useCandidateEnrichment` hooks. On file drop: `parseStep='parsing'`. When parse hook resolves contact/professional fields: `parseStep='done'` AND `enrich='working'`. When enrichment hook returns skills + summary: `enrich='done'`. Clearing the file resets both to `idle`. (For the visual prototype the spec mentions, the same states are settable via `setTimeout` 1800ms / +3400ms — we'll keep the real hook wiring and only fall back to timers if hooks aren't yet emitting these milestones.)

## Section order (Add and Edit identical)

1. **Résumé** — header has `ResumeStatusBadge` (idle: lilac sparkles "Gio will auto-fill" · parsing: lilac sparkles "Step 1 · parsing" · done: green dot "N fields auto-filled"). Dropzone renders one of three layouts per spec (dashed idle / lilac parsing row with spinner + `.gio-progress` bar / white done row with Replace + trash).
2. **Identity** — 2-col: First name*, Last name*, Email* (helper "Used to detect duplicate candidates."), Phone, LinkedIn URL (full width).
3. **Source & assignment** — 2-col Source* + Referred by; below, optional "Assign to a job" select with talent-pool helper; on select, reveal "Starting stage" chips. Edit mode: swap the picker for a list of `AssignmentRowCard` rows + "Add to a job" header action.
4. **Professional** — Current role (full), Current company, Years experience (suffix "years"), Location (full), Salary expectations (currency + min/max + period).
5. **Skills** — `SkillsSection` (idle input / `GeneratingCard variant="pills"` / done chip cloud with "+ N more" and Add skill). Header right-badge "N detected" only when `done`.
6. **Profile summary** — `ProfileSummarySection` (idle hint / `GeneratingCard variant="lines"` with 4 shimmer lines / done paragraph + "Gio generated" badge + ghost Regenerate).

## Footer

- Primary `Add candidate` (with `user-plus` icon) stays enabled whenever required fields are valid — **including while `enrich='working'`**. Saving mid-enrichment persists immediately; the background enrichment job patches skills + summary onto the saved candidate when it returns (uses the existing `triggerBackgroundEnrichment` flow).
- Secondary `Save & add another`, ghost `Cancel`.
- Left side: `FooterStatusLine` mapping state → message exactly per spec (parsing / enrich working / done / idle dedup hint).

## Edit mode differences (data-driven only, same components)

- Section 3 renders the "Current assignments" list instead of the assign-to-job picker.
- Sections 5 and 6 mount in `done` state (skills + summary already on the record); no skeletons.

## Animations (added once to `src/index.css`)

```css
@keyframes gioSpin    { to { transform: rotate(360deg); } }
@keyframes gioBar     { 0% { left: -40%; } 100% { left: 100%; } }
@keyframes gioShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
@keyframes gioPulse   { 0%,100% { opacity: 1; } 50% { opacity: .35; } }

@media (prefers-reduced-motion: reduce) {
  .gio-spinner, .gio-progress > span, .gio-skeleton, .gio-pulse { animation: none; }
  .gio-skeleton { background: #EFEAFB; }
}
```

Utility classes per spec (spinner = 2px purple ring with top color; progress = 4px lilac track + absolute 40% purple bar; skeleton = three-stop lilac gradient with 400% bg-size; pulse = sparkles opacity loop).

## Explicitly NOT changing

- No edge-function changes; reuse `parse-resume` output already wired (now includes role/company/years from the earlier task).
- No new tokens, fonts, radii.
- No reordering only in one mode — both Add and Edit follow the same six-section order.
- No blocking spinner over the form during enrichment; the form remains fully usable.
