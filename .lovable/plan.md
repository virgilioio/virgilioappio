## Scope

Visual + structural redesign of `CandidateFormSheet` to match the attached mockups for both **Add candidate** (new) and **Edit candidate** (existing) modes. No new fields, no new data flow, no schema changes. All existing logic (resume parsing, dedupe, job assignment, skills AI, fit-analysis triggers) stays intact.

Unification path: both `CandidateProfileSheet` (job-pipeline) and `IndependentCandidateProfileSheet` (talent-pool) already mount `CandidateFormSheet` for editing (`CandidateProfileSheet.tsx:1610`, `IndependentCandidateProfileSheet.tsx:794`). Redesigning the form sheet automatically unifies the edit experience — no router or caller changes needed.

---

## Mockup → component mapping

| Mockup element | Where it lands |
|---|---|
| Eyebrow `CANDIDATES` + title `Add candidate.` / `Lena Park.` + subtitle | `SheetHeader` in `CandidateFormSheet` (replaces current bare title) |
| `In 2 pipelines` badge (edit only) | Inline next to title when `candidate` + association count > 0 |
| `RESUME / IDENTITY / PROFESSIONAL / SKILLS / SOURCE & ASSIGNMENT` cards | New section primitive: uppercase 12px label outside, card with rounded border + 24px padding inside |
| `Parsed by Gio` chip · `23 fields auto-filled` / `v2 · current` right meta · `Replace` + trash | Resume card chrome around existing `EnhancedResumeDropzone` parsed state |
| Inputs with leading icons (briefcase, building, mail, phone, @, map-pin, $) | Add `icon` slot to the inputs already wrapped in `FormField` |
| 4-cell salary grid (currency / min / max / period) | Restructure existing Salary section grid |
| Pastel removable skill chips + `+ 7 more` + inline `Add skill…` + `14 detected` right badge | Restructure existing skills section using current `getSkillColor` + `<Badge onRemove>` |
| `CURRENT ASSIGNMENTS` row cards (edit only) | New read-only listing inside edit mode; data already loaded by parent profile sheet — pass via prop OR re-fetch via existing `useCandidateJobAssociations` |
| Add footer: dedupe count · Cancel · `Save & add another` · `Add candidate` | Replace current footer; "Save & add another" wires to existing submit + reset |
| Edit footer: Cancel · added/edited meta · `Open profile` · `Save changes` | Replace current footer; meta from `candidate.created_at` / `updated_at`; `Open profile` no-ops in independent context (already on profile), navigates in pipeline context |

---

## Files to edit

**Primary**
- `src/components/candidates/CandidateFormSheet.tsx` — full visual rework of header, every section header, every field row, resume chrome, skills chrome, footer. Internal logic untouched.

**New (small, in `src/components/candidates/form/`)**
- `CandidateSheetHeader.tsx` — eyebrow + title + period + subtitle + optional `In N pipelines` badge.
- `CandidateSheetSection.tsx` — uppercase label + optional right-meta slot + bordered card body.
- `ResumeCard.tsx` — file chip + Parsed-by-Gio badge + auto-fill counter + Replace/Delete; wraps `EnhancedResumeDropzone` (parsed state) and renders the empty dropzone state when no resume.
- `AssignmentRowCard.tsx` — row used in `CURRENT ASSIGNMENTS` (edit only).
- `CandidateSheetFooter.tsx` — two variants (`add` / `edit`) matching the mockups.

**Touch (1-line widths only)**
- `src/components/candidates/CandidateProfileSheet.tsx` and `src/components/candidates/IndependentCandidateProfileSheet.tsx` — no behavior change. If the new `Open profile` button needs a callback in edit mode, add a prop wired from the parent. Otherwise zero changes.

**Untouched**
- `UniversalCandidateProfileSheet.tsx`, all hooks, all edge functions, `EnhancedResumeDropzone` internals, `SkillsGenerationPanel`, all callers (`JobDetail`, `Candidates`, `GlobalCreateButton`, `SearchResultsDialog`, `GlobalSearchBar`).

---

## Structural decisions

1. **Width.** Bump `SheetContent` from `sm:max-w-[540px]` → `sm:max-w-[720px]` to match the mockup proportions and let the 2-col grids (name/email, role/company-years, currency/min/max/period) breathe.
2. **Section style — single source.** Replace both inconsistent `h3` styles currently in use with one `CandidateSheetSection` primitive. Uppercase Poppins 11.5/0.06em label per `docs/style-guide.md` typography. Bordered card body (`rounded-xl ring-1 ring-virgilio-border/60 p-6`).
3. **Inputs.** Keep `<Input>` height at the existing 44px form standard. Add a leading-icon slot used by Role (briefcase), Company (building), Email (mail), Phone (phone), LinkedIn (@), Location (map-pin), Salary (dollar). Icons from `lucide-react` already in the project.
4. **Skills section.** Keep current logic (`getSkillColor`, `SkillsGenerationPanel`). Visual changes only: chips become `<Badge tone={...} onRemove>` per the badges memory; replace the trailing `Plus` button with the inline `Add skill…` ghost input shown in the mockup; render `+ N more` collapse when >7 skills; add `14 detected` / `14 total` right-meta badge in the section header (count is just `skills.length`).
5. **Resume card.**
   - Empty state = existing dropzone full-width inside the card.
   - Parsed state = file chip (icon + filename + `KB · uploaded X` + `Parsed by Gio` green dot badge) + `Replace` text button + trash icon button. `Replace` opens the same hidden file input the dropzone already uses; trash calls the existing delete attachment flow (edit mode only).
   - Right meta: `N fields auto-filled` (add mode, count from existing parse result) OR `vN · current` (edit mode, from `candidate_attachments` version).
6. **Assignments (edit only).** New read-only `CURRENT ASSIGNMENTS` section using `useCandidateJobAssociations` (already imported in profile sheets). Rows show briefcase icon, job title, department, stage badge (existing stage color tones), and a danger `X` that calls the same removal hook used in the profile sheets. `+ Add to a job` button in the section header opens the existing `AddToJobPipelineDialog`. No new mutations.
7. **Add-mode "Assign to job" section** (existing section 3) collapses into the new `SOURCE & ASSIGNMENT` card per the mockup: Source select + Referred-by + Assign-to-job + Starting-stage pills. All using existing hooks and existing options. The starting-stage pill row reuses the same `useJobHiringPlan.loadHiringPlanInstances` data, rendered as `<Badge>` pills with one selected.
8. **Footer.**
   - Add: `We'll de-duplicate against your existing N candidates.` (N from `useCandidateCount` if present, else hide line), `Cancel` (secondary), `Save & add another` (secondary), `Add candidate` (primary, dark). "Save & add another" reuses `onSubmit` then resets the form and keeps the sheet open — no new endpoint.
   - Edit: `Cancel` (secondary), inline meta `Added {MMM d, yyyy} · last edited {Xd ago}` using `date-fns` already in the project and the existing `Xd` concise format rule, `Open profile` (secondary, link out), `Save changes` (primary, dark).
9. **Inconsistent heading styles** (current sections 1–2 vs 3–7) are eliminated by routing every section through `CandidateSheetSection`.
10. **Profile Summary section.** Mockup does not show it explicitly inside the visible crops, but it exists today and must stay. Keep it as a section right after Skills (Add) / before Current Assignments (Edit) using the same new section primitive. `<RichTextEditor>` unchanged.

---

## Out of scope (explicit guardrails)

- No new fields, no new schema columns, no new edge functions.
- No changes to resume parsing, AI skill generation, dedupe logic, or fit-analysis triggers.
- No router changes in `UniversalCandidateProfileSheet`.
- No changes to `CandidateProfileSheet` tabs/activity/notes/scorecards — only the small prop wiring for `Open profile` if needed.
- No mobile-specific rework beyond ensuring the new layout still collapses correctly (mobile is consultation-first per memory; edit is already desktop-primary).
- The `In 2 pipelines` badge count uses existing association data — no new query.

---

## Validation

After the rework I will:
1. Open the sheet via `JobDetail` (Add + Edit), `Candidates` page (Add + Edit), `IndependentCandidateProfileSheet`, and `GlobalCreateButton` to confirm all five mount points render correctly.
2. Run through a parse → edit → save cycle to confirm `EnhancedResumeDropzone`, `SkillsGenerationPanel`, and `handleUpdateCandidate` still fire unchanged.
3. Screenshot the live sheet in both modes and compare against the attached mockups.

---

## Estimated file impact

~1 file heavily rewritten (`CandidateFormSheet.tsx`, ~1000 lines → ~900, mostly markup), 5 small new files (~80 lines each), 0–2 line prop additions to two profile sheets. No migrations, no edge functions.