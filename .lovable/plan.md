
# Job Detail Visual Redesign

Goal: replicate the three uploaded screens (`05_Pipeline_board_view`, `06_Application_Review`, `07_Job_Setup`) on `/jobs/:id`. **Frontend only — no schema, hook, or query changes.** Reuse existing primitives (`Button`, `Badge`, `PageHeader`, `Tabs`, `Card`, `Avatar`, `Table*`, `TableToolbar`, `TableSearch`, `IdentityCell`, `StatusCell`, `Alert`, `Breadcrumb`). Only edit/extend visuals.

## What the mockups establish (and what we're missing today)

### A. Job hero (all three screens)
Current: `PageHeader title compact` shows nothing visible; title+meta+actions are scattered.
Target:
- Breadcrumb: `Jobs › <Department>`  (small, muted)
- H1 `Senior Product Designer` + purple period accent (Poppins, ~32px)
- Meta row (sm body, muted): Open dot-badge · `📍 Remote · US` · `🏢 Design` · `🕐 Posted 9 days ago` · `Hiring team` + avatar stack
- Right cluster: `Share` (secondary), `View posting` (secondary, ext-link icon), `Add candidate` (primary black), `…` overflow

### B. Top tabs
Current: mobile = 3-grid TabsList; desktop = no top tabs (sub-tabs only).
Target: plain underlined Tabs everywhere — `Pipeline` · `Job Dashboard` · `Setup`. Active = bold + 2px black underline (the existing default `<TabsList variant>` works once we strip the grid styling).

### C. Pipeline tab — section row (Suggested / Application review / Recruiting process / Job offers / Hired / Rejected)
Current: huge h-14 grid with neon gradients and pulsing glow.
Target: single horizontal pill row inside a white surface with hairline border:
- Each item = label + small dark count chip (`bg-citron-noir text-cream`) right-aligned
- Inactive = transparent
- Active = filled tonal pill (`bg-pastel-purple` for application, `bg-pastel-yellow` for recruiting, `bg-pastel-blue` for offers, `bg-success/15` for hired, `bg-destructive/15` for rejected, `bg-pastel-purple/40` for suggested) with `Sparkles` only on Suggested
- Use existing `Badge` for the count chip, `cn`-built button-style triggers (no new component)

### D. Pipeline toolbar (above board/table)
Current: `CardHeader` with "Pipeline Overview" title + paragraph + buttons.
Target: flat toolbar (no card title):
- Left: `TableSearch` placeholder "Search in pipeline..." + filter pill `2 filters`
- Right: Board/List segmented (rounded-full, existing `ToggleGroup` restyled to match), `Select` (secondary), `Add candidate` (primary black)
- Drop the "Pipeline Overview" h1 + helper paragraph

### E. Pipeline board cards & columns
Current cards already close; column chrome differs.
Target column header (in `PipelineOverview`):
- Colored dot (uses stage type color) + bold stage name + small muted count + `…` button
- No card border on column wrapper; instead a vertical container with subtle hairline rule between columns
- Empty drop zone: 2px dashed `border-border` rounded-lg button "+ Add candidate" at column bottom (already exists; restyle to match)
Card body tweaks (`CandidateCard.tsx`): purple avatar fallback, name bold, title @ company in muted, footer row `✦ <score>`  · `🕐 Xd` (left) and optional `Due tmrw`/heart (right). Strip extra chrome that doesn't appear in the mockup (move-to-stage select, status badges) — keep them only in list view.

### F. Application review tab (sub-tab `application`, list mode)
Target structure:
1. Lilac AI banner (existing `Alert` variant or `<UnifiedAIBanner>`):
   - Sparkle icon, title "Gio has reviewed N new applications", subtitle "X ranked strong fit · Y worth review · Z likely no-fit. Sorted by AI fit score by default."
   - Right: purple `Review queue` button + close
2. Toolbar: `TableSearch` + Sort `Select` + spacer + counter text "N in queue · X over Y days" + black `Start review` button
3. Data table using new Gio table primitives:
   - Columns: `#` (NumericCell), `CANDIDATE` (IdentityCell), `TOP SKILLS` (badge stack + `+N`), `AI FIT` (NumericCell colored by score with mini sparkline placeholder), `APPLIED` (relative time), `STATUS` (StatusCell with mail icon), `ACTIONS` (reject `×` outline + accept `✓` solid black, ActionCell pattern but always-visible)
   - Row hover = flat fill, selected = purple left rail (already in `Table` v1)

### G. Setup tab
Current: `JobSetupPanel` with 4 inner sub-tabs (Overview / Hiring Team / Hiring Plan / Job Postings).
Target: single scroll, 2-column layout (main 2/3 + rail 1/3):
- Main column:
  - **Job description** card with `Edit` button top-right; reuses `JobOverviewTab` description block
  - **Hiring stages** card with `Add stage` button; rows = drag handle · numbered colored circle (1,2,3 with stage color) · name + sub-line · `…` per row. Reuses `HiringPlanTab` content but restyled
- Right rail (sticky):
  - **Status** card: Status (Open dot-badge) · Posted · Target start · Slots
  - **Compensation** card: huge `$185k – $210k`, sub "base · plus equity & bonus", lilac AI insight banner
  - **Hiring team** card with `+ Add` and member rows (avatar · name · role)
- Hiring Team & Job Postings move into separate routes/sheets later (out of scope) — for now keep them accessible via their current entry points and just restructure the Setup landing.

## Files to edit (frontend only)

1. `src/pages/JobDetail.tsx`
   - New job hero block (breadcrumb + title + meta + right action cluster) replacing current `PageHeader compact`.
   - Replace top `TabsList` with a single underlined `Tabs` (Pipeline / Job Dashboard / Setup) on both mobile and desktop.
   - Replace the colored sub-tab grid with a new local `<PipelineSectionTabs>` pill row.
   - Replace `Card`-titled pipeline header with a flat toolbar.
   - Application sub-tab: render new `<ApplicationReviewSection>` block (banner + toolbar + table) instead of the current generic kanban view.

2. `src/components/jobs/PipelineOverview.tsx`
   - Restyle column header (dot + name + count + `…`); drop card chrome around columns; add hairline divider.
   - Restyle list-view drop button.

3. `src/components/jobs/CandidateCard.tsx`
   - Trim card to mockup: avatar / name / title @ company / footer (score · time · heart/Due).
   - Hide stage selector + extra status icons in board view (still shown in list view).

4. `src/components/jobs/JobSetupPanel.tsx`
   - Replace inner `Tabs` with the 2-column Setup layout described above.
   - Reuse `JobOverviewTab` description, `HiringPlanTab` for stages, new local sidebar cards for Status / Compensation / Hiring team (composed from `Card`, `Badge`, `Avatar`).

5. `src/components/layout/PageHeader.tsx`
   - Extend (don't break) to optionally accept `breadcrumb`, `meta`, and `actions` slots, OR build the hero inline in `JobDetail.tsx` to avoid impacting other pages. **Decision**: build inline in `JobDetail.tsx` to keep `PageHeader` shared semantics intact.

## Out of scope
- No backend, hook, query, or schema changes.
- No new tables, RLS, or routes.
- No re-architecting of `HiringPlanTab` / `HiringTeamTab` / `JobPostingsTab` internals — they're reused as-is or via lighter wrappers.
- Mobile parity will use the same primitives (toolbar collapses, sidebar stacks under main).

## Risks
- `PipelineOverview` is large (994 lines) — visual changes only, no logic edits.
- Application review currently lives behind `ApplicationReviewSheet`; the new in-tab table reads from the same data source (`applicationReviewCandidates`) already loaded in `JobDetail.tsx`.
