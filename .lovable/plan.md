# Two-part plan

## Part A — Primary buttons go black everywhere

### Problem
Across forms, sheets, modals, email composers, job-post forms, and the wizard, the "primary action" button (Save / Create & continue / Add candidate / Send invitation, etc.) renders **purple** instead of **black + Opaline-white text** as required by the Gio Foundation style guide §2.

Root cause: `<Button>` with no `variant` falls back to the legacy `default` variant in `src/components/ui/button.tsx`, which is still wired to purple. Hundreds of call sites use plain `<Button>` and inherit this.

### Fix (one-line origin, large reach)
Flip the legacy `default` variant in `src/components/ui/button.tsx` to mirror `primary` (citron-noir `#0d0d09` fill, `#fffcf9` text, button shadow, correct hover/active). This is the change the style-guide comment in that same file already anticipates ("default → purple (will flip to primary later)").

Effect: every plain `<Button>` across the app — form submits, sheet footers, modal confirms, wizard CTAs, email composers, job-post forms — automatically becomes the spec-correct black primary, with zero call-site edits.

### Cleanup pass (small, targeted)
1. **Remove redundant overrides** on call sites that hand-rolled white text to fake the look. Example: `src/pages/Jobs.tsx` uses `variant="primary" … className="text-white [&_svg]:text-white"` — drop the className.
2. **Preserve intentional purple actions** (Gio / AI / CRM commits) by giving them an explicit `variant="purple"` if they were silently relying on default. Audit targets: AI banners, "Generate with Gio" buttons, CRM deal confirms. If any of these currently use plain `<Button>` expecting purple, switch them to `variant="purple"` so they don't flip to black.
3. **Wizard footer**: `JobWizard.tsx` "Create & continue" and step-level "Continue to Team" already use plain `<Button>` → will become black automatically. No edit needed.
4. **Update the Core memory note** "Form submit + datepicker standard" to reflect that "default Button" now means black (per spec), not purple.

### Verification
- Spot-check screens: Candidates → Add candidate, Jobs → New job wizard, Email composer, Settings → invitations, Offer creation.
- Confirm Gio/AI/CRM purple actions still render purple.
- No layout shift — `primary` and `default` share the same size tokens.

---

## Part B — Job wizard Step 2: Hiring plan

Rebuild `src/components/jobs/wizard/HiringPlanStep.tsx` to match the reference (`30b_Create_job_2_Hiring_plan.html` + screenshots). The wizard chrome (left rail, header eyebrow, sticky footer) is already in place from Step 1 — only the step body changes, plus footer label tweaks.

### Header
- Eyebrow: `CREATE JOB · STEP 2 OF 4`
- Title: `Hiring plan.`
- Subtitle: "The stages candidates progress through. Drag to reorder. Application review and Offer are required system stages."
- Left rail item 2 active; item 1 shows green check.

### Section 1 — TEMPLATE
Three selectable template cards with a top-right `✨ Gio recommends` lilac chip:
1. **Workspace default** — black icon tile, "Application → Screen → Take-home → Onsite → Final → Offer" (selected by default; lilac border/fill highlight).
2. **Lean tech hire** — blue icon tile, "Application → Screen → Tech onsite → Offer · 4 stages".
3. **Exec / leadership** — purple icon tile, "Adds 2 leadership rounds + back-channel references".

Selecting a template replaces the stages list below.

### Section 2 — STAGES
- Section header with right-aligned `+ Add stage` secondary button.
- Reorderable list (dnd-kit, CSS Translate per design philosophy).
- Each row: drag handle · numbered colored circle · stage name + meta · optional badges (`Required`, `• AI` lilac dot, `SLA <value>`) · `Configure` ghost link · `Rename` ghost link · trash icon (hidden for required stages).
- Color cycle for circle: purple, blue, pink, purple, orange, green, green (matches reference).
- First stage (`Application review`) and last stage (`Offer`) are required system stages: no trash, `Required` badge.

### Section 3 — AUTO-REJECTION RULES
Card with toggle rows (reuse `ToggleRow` from `_parts.tsx`):
- Outside listed locations — "Reject candidates not in the job's open regions." (on)
- Salary expectation >25% above range — "Reject and keep on file." (on)
- Same candidate, last 90 days — "Auto-reject re-applicants for the same role." (off)

### Section 4 — AI AUTO-SCREEN
Card with `✨ Gio` lilac chip top-right. Toggle rows:
- Auto-score every application — "Scores 0–100 based on required skills and experience." (on)
- Auto-reject scores below — same row exposes a small numeric input (default 35) with `/100` suffix, plus toggle (on).
- Generate AI candidate summary — "3-paragraph summary attached to each candidate profile." (on)

### Sticky footer (existing chrome)
- Left: `‹ Back`
- Center: `7 stages · avg time-to-hire estimate 32 days` (computed from stages list)
- Right: `Save and exit` (secondary) · `Continue to team ›` (primary, now black)

### Persistence
Reuses the existing `useJobStages` / `useStageAutomations` / hiring-plan hooks already powering `HiringPlanTab`. New AI auto-screen + auto-rejection toggles persist via `useStageAutomations` / `useWorkspaceAutomation` (or a per-job extension if needed). Template selection writes a stage preset; switching templates after manual edits prompts a confirm.

### Files touched
- `src/components/ui/button.tsx` — flip legacy `default` variant to black.
- `src/pages/Jobs.tsx` and a small handful of other call sites — drop redundant `text-white` overrides.
- `src/components/jobs/wizard/HiringPlanStep.tsx` — full rebuild.
- `src/components/jobs/wizard/_parts.tsx` — add `TemplateCard`, `StageRow`, `GioRecommendsBadge`, reuse `SectionCard` + `ToggleRow`.
- `src/components/jobs/JobWizard.tsx` — Step 2 footer label ("Continue to team"), footer meta string.
- `mem://index.md` — refresh the Core note about primary submit being black.

### Out of scope
- Steps 3 (Hiring team) and 4 (Summary) — waiting for refs.
- New backend columns — none needed; existing stages/automations tables back this step.
