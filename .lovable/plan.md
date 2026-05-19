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

---

# Step 3 — Hiring team

Rebuild `src/components/jobs/wizard/HiringTeamStep.tsx` to match `30c_Create_job_3_Hiring_team.html` and screenshots. Wizard chrome (left rail, header eyebrow, sticky footer) already in place — only the step body + footer label change.

## Header
- Eyebrow: `CREATE JOB · STEP 3 OF 4`
- Title: `Hiring team.`
- Subtitle: "Who can see this job, and what they can do. Add as many people as needed; assign roles for what they'll do on this job specifically."
- Left rail: items 1 + 2 green-check, item 3 active black.

## Section 1 — OWNERS (white card)
Two required selectors stacked, then a two-up grid of optional fields:
- **Primary recruiter** *  — searchable member select; selected pill shows avatar + name + title + email. Hint: "Owns the job — receives all candidate notifications."
- **Hiring manager** *  — same shape. Hint: "Owns the bar and the final decision."
- **Reports to** (optional) — searchable member select (user icon leading).
- **Coordinator** (optional) — searchable member select, default "Same as recruiter" (calendar icon leading). Hint: "Schedules + reminders. Defaults to recruiter."

## Section 2 — TEAM MEMBERS
- Section header with right-aligned `+ Add member` secondary button (`UserPlus` icon).
- Card body: list of workspace member rows, each with:
  - Checkbox (selected = lilac filled).
  - Avatar + name + sub-title (role/team).
  - Role `<Select>` ("Interviewer", "Pick a role…" placeholder when unselected).
  - Trailing scope label (`Owner · all access`, `HM · view + scorecards`, `Interviewer · scorecards`, `—`).
  - Trailing settings cog icon (per-member access toggle, opens popover later).
- Unchecked rows render with reduced opacity.
- Driven by `useMembers(true)` + `useJobAssignments(jobId)`. Owners auto-checked and locked.

## Section 3 — ROLES ON THIS JOB
Card with right-aligned `ⓘ What can each role do?` ghost link. 6-tile grid (3×2) describing each role with its assigned count badge:
- **Recruiter** (lilac) — "Source, screen, schedule, send offers."
- **Hiring manager** (yellow) — "Calibrate, review scorecards, decide."
- **Interviewer** (orange) — "Submit scorecards on assigned interviews."
- **Coordinator** (lilac) — "Schedule meetings, manage reminders."
- **Sourcer** (green) — "Source-only — can't see entire pipeline."
- **Observer** (green) — "View-only, no actions."

Each tile uses the standard Badge token color matching its purpose, count number top-right in Poppins tabular-nums. The active role (`Hiring manager` in screenshot) gets a darker highlight.

## Section 4 — NOTIFICATIONS
Card with three `ToggleRow`s:
- **Notify owners on new applications** — "Slack DM + email to recruiter + HM" (on)
- **Daily digest at 9:00 AM** — "Activity summary to recruiter only" (on)
- **Notify hiring team when stage moves** — "Slack channel #hiring-design" (off)

## Sticky footer (existing chrome — extend wizard)
- Back · `4 members assigned · 1 recruiter · 1 HM · 2 panelists` (computed) · `Save and exit` · **Review & create ›** (advances to Step 4).
- `JobWizard.tsx` `primaryCta` switch gains case `3` → label "Review & create", `onClick = handleNextStep`.

## Persistence
- Primary recruiter & Hiring manager → `job_assignments` rows with `role` `recruiter`/`hiring_manager` (one each per job).
- Team-member checkboxes → `job_assignments` rows with chosen role.
- **Existing enum** (`recruiter | hiring_manager | interviewer`) covers the picker; the three extra role tiles (`coordinator`, `sourcer`, `observer`) render UI-only in this pass and surface a "Coming soon" tooltip on the role `<Select>` options. No schema change in this step.
- `reports_to`, `coordinator`, and the three notification toggles are UI-only for now (stored in wizard local state, flagged in a follow-up to persist on `jobs` or a per-job `job_notifications` table once the user wants it).

## Files touched
- `src/components/jobs/wizard/HiringTeamStep.tsx` — full rebuild.
- `src/components/jobs/wizard/_parts.tsx` — add `MemberSelect` (searchable single-select with avatar pill), `MemberRow` (checkbox + avatar + role select + scope + cog), `RoleCard` (count tile with tone), reuse `SectionCard` + `ToggleRow`.
- `src/components/jobs/JobWizard.tsx` — extend `showFooter` to include step 3; add step-3 case to `primaryCta` ("Review & create"); update sticky footer meta line to show assignment counts when on step 3.

## Out of scope
- Step 4 (Summary) — waiting for reference.
- Backend extension for the three additional roles + per-job notifications — separate migration ticket once the user confirms enum expansion.
