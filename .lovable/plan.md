# In-job candidate profile rebuild

A reskin and reorganization of `/jobs/:jobId/candidates/:candidateId`. No data-model or flow changes — all existing wiring (advance, schedule, booking link, email, reject, application switcher, Full profile link, offer composer) is preserved. Terminal-status banners (Offer / Rejected / Hired) are NOT in scope and keep their current behavior.

## Scope at a glance

```text
┌─────────────────────────────────────────────────────────────────┐
│ HERO CARD  (radius 16, 14px 24px 0)                             │
│  Row 1  ← Back · breadcrumb · — · AI FIT · Advance · Sched · …  │
│  Row 2  Name. ♥  ·  [stage · 4d in stage]                       │
│  Row 3  Applying for {job}⌵ · Source · Applied · 👤 Full profile│
│  Row 4  Tabs (underline sits on card edge)                      │
├─────────────────────────────────────────────────────────────────┤
│ STAGE STEPPER CARD  (radius 16, p12)                            │
├─────────────────────────────────────────────────────────────────┤
│ BODY   1fr  +  320px sidebar  (gap 16) — per-tab               │
└─────────────────────────────────────────────────────────────────┘
```

Hero + stepper render IDENTICALLY on every tab; only the body grid swaps.

## New primitives (`src/components/candidates/profile/primitives/`)

- `ProfileCard.tsx` — white, radius 14, header (14/20/12 + hairline) with title, optional subtitle, right action slot; body p20. Replaces ad-hoc `<section>` usage in tab bodies.
- `Sidebar.tsx` — single card (p16) wrapper + `SidebarBlock` (label + optional right action) + `MetaRow` (icon/label/value with hairline) + `FileRow` + `LinkRow`.
- `StatTile.tsx` — `#FAFAF7` tile: green icon + uppercase label + Poppins 16/600 value (used in Gio job-context card).
- `BorderedTile.tsx` — generic bordered tile with eyebrow label (NEXT EVENT, INTERVIEWERS).
- `VerdictChip.tsx` — dot + label, color by verdict (Strong yes/Yes/Lean yes/No/Strong no/Pending).
- `SegmentBar.tsx` — 5×12 pill bar (filled = noir) for scorecard areas.

## Updated existing primitives

- `ProfileHeroCard.tsx` — relax to spec (no avatar, dot-chip with "{n}d in stage", AI FIT pill restyle, breadcrumb tweak); padding `14px 24px 0` so the tab strip sits flush on the card edge; remove its own `mt-4` wrapper around tabs.
- `ProfileTabs.tsx` — keep API; visual tweak so count pill matches spec (active = noir/cream, idle = `#F1F0EC`/`#5A6072`).
- `ProfileStageStrip.tsx` — already 95% correct; tighten chip to spec (radius 10 / p10×12 / Poppins 11.5 / Inter 10.5 line 2; passed = `#D1FAE5`/`#065F46` with `#12B886` circle + white check).

## Per-tab body + sidebar components

Each tab gets two thin presentational components (`*Body.tsx`, `*Sidebar.tsx`) under `profile/tabs/`. The container `CandidateProfileSheet` continues to own all data hooks and passes props down — no new data flow.

| Tab | Body components (top→bottom) | Sidebar blocks |
|---|---|---|
| Job overview | CurrentStageCard (refit with NEXT EVENT + INTERVIEWERS tiles) · ScorecardsSection · JobContextCard (Gio, conditional) · TopSkillsCard | QuickActions · Application · Job information · Links · Files |
| Resume | ResumeViewerCard (PDF toolbar + render, padding 0) | File · Parsed by Gio · Actions |
| Overview | ContactInformationCard · SkillsCard · ProfileSummaryCard (Gio, **fixed markdown rendering**) · ExperienceCard · EducationCard | Tags · Links · Files |
| Scorecards | SubmittedScorecardsCard · SideBySideComparisonCard (Gio, conditional) | Summary · Verdict distribution · Pending |
| Activity | ActivityCard (existing `ActivityFeedList` rewrapped) | Filter (functional checkbox filter) · Stats |
| Emails | EmailsCard (newest expanded inline) · ConversationInsightsCard (Gio, conditional) | Engagement · Activity · Connected inbox |
| Comments | CommentsCard (existing `CandidateComments` rewrapped in `ProfileCard`) | Mentions · Visible to |

Gio cards (job context, scorecard synthesis, email insights), engagement stats, and parsed-resume counts render only when the underlying data exists.

## Sheet wiring changes (`CandidateProfileSheet.tsx`)

1. Replace lines ~1259-1670 (the `grid lg:grid-cols-3` body) with:
   ```tsx
   <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
     <main>{renderTabBody()}</main>
     <aside>{renderTabSidebar()}</aside>
   </div>
   ```
2. Move terminal-status tab bodies (offer / rejection-details / onboarding) into `renderTabBody()` unchanged — they already work.
3. `?tab=…` URL persistence: read `searchParams` on mount, push on tab change (active tab persists in URL). Skips for sheet (non-`asPage`) mode.
4. Profile-summary fix: anywhere the existing Gio summary prints raw `\n\n` / `**bold**` as plain text, route through `ProfileSummaryMarkdown` (already exists) inside the new `ProfileSummaryCard`.

## Foundation tokens used

All values come from existing tokens where present (`virgilio-purple`, `virgilio-border`, `text-primary/secondary/tertiary`, `pastel-green*`). Spec hexes that aren't already tokens are inlined as Tailwind arbitrary classes (e.g. `bg-[#FAFAF7]`, `border-[#E7E8EE]`, `bg-[#FAF8FF]`) — consistent with the rest of `/profile/*`.

## Explicitly out of scope

- Terminal-status banner content & behavior (Offer/Rejected/Hired) — only their tab bodies get re-wrapped in `ProfileCard`.
- Data model, hooks, edge functions, RLS.
- Independent candidate profile (`/candidates/:id`).
- Mobile layout (consultation-first rules already restrict mobile editing).

## Risks / open questions

- **Email "Engagement / open rate"** — current schema doesn't track opens/clicks. The Engagement sidebar block will render `—` and an "Open tracking not configured" hint rather than fake data. Confirm OK, or hide the block entirely until tracking lands.
- **Scorecard verdict colors** for "Lean yes" — spec says yellow; existing `VerdictChip` uses neutral. I'll add yellow per spec.
- **Tab URL persistence** — should this apply only to `asPage` mode (full-page route), or also when the sheet is opened from the pipeline kanban? Plan: full-page only, to avoid clobbering the route when used as a sheet.

Once approved I'll build new primitives + per-tab files in parallel, then wire `CandidateProfileSheet` in a single edit.
