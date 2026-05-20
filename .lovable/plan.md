# Find results — redesign candidate list to match screenshot

Goal: align the right pane (after a search loads) with the reference screenshot. Three visible blocks change: the tabs above the list, an AI summary banner, and the candidate rows themselves. Functional behavior — fetching, reveal/collect, add-to-job, profile sheet, bulk select — stays exactly as-is.

## What differs today vs. the screenshot

Current:
- Four big colorful pipeline-style tabs at the top (`Chat with Gio`, `Candidates`, `Saved`, `Archived`) with pastel gradients.
- Candidate rows are dense single-column `<TableRow colSpan={5}>` blocks with a tiny source badge, name + role line, small meta chips, and `Add` / `Reveal` / `View` buttons. Match score sits as a small badge top-right.
- Plain `Page 1 of N` pagination at the bottom.
- No AI summary banner above the list.

Screenshot:
- AI summary banner — lilac sparkle tile + `107 candidates · 28 strong fit · 47 good · 32 possible`, sub-line `Sourced from LinkedIn (86), Apollo (21), Internal (12). Top match: Priya Iyer · 94 fit.`, right-aligned `Why these results?` link.
- Meta row below banner: `Showing 1–25 of 107` (left) + flat tab strip `All 107 · Strong fit 28 · New 12 · Saved 8` (center) + `Sort: AI fit` and `Select` buttons (right).
- Candidate rows as roomy cards: 44px purple avatar circle, name + inline status badge (`In project`, `Contacted`), role line, meta dots (location · exp · activity · source), skill chips (green with checkmark for matched, neutral for unmatched), bottom action row (`Add to job` primary, `Reach out`, `Saved`, `View profile`), AI FIT score boxed on the far right, thumbs-down + kebab bottom-right.

## Changes

### 1. `src/components/sourcing/SourcingProjectView.tsx` — drop the big colored tabs

Replace the four-pastel `TabsList` with no chrome around the candidate body. The `Chat with Gio`, `Saved`, and `Archived` views still need to be reachable, but they move out of the top tab strip:

- `Chat with Gio` → a small `purple` button in the project-card header (already has Sparkles icon) that opens the conversation panel as an overlay/drawer (reuse existing `ConversationTab` inside a `Sheet`). Out of scope for this round if too risky — fall back to a small purple link button under the AI summary banner that toggles inline.
- `Saved` and `Archived` → become filter chips inside the new in-list tab strip alongside `All / Strong fit / New`. (`Saved` shows `savedCandidates`, `Archived` is demoted to a kebab item on the project actions menu.)

For this round, scope the change to:
- Remove the colorful `TabsList` block entirely.
- Render `CandidatesTab` directly as the project body.
- Move `Saved` into the new in-list tab strip; leave `Archived` and `Chat with Gio` accessible only via the project actions menu / existing routes (filed as follow-up if needed).

### 2. `src/components/sourcing/CandidatesTab.tsx` — host the new toolbar

Add a header inside the tab, above the list, that renders three stacked blocks:

a) **AI summary banner** — a single lilac surface (`bg-virgilio-lilac/30`, hairline border, 12px radius, padded 16px). Left: sparkles icon in a purple tile. Center: stacked counts line + `Sourced from … Top match …` sub-line. Right: `Why these results?` ghost link with chevron. Counts come from `sourceBreakdown` and tier counts derived from `candidates` (`strong` = excellent, `good`, `possible` = fair+minimal). Top match = highest-score candidate name + score.

b) **Toolbar row** — `Showing X–Y of Z` (left, text-body-sm, text-text-secondary) · flat tab strip (`All`, `Strong fit`, `New`, `Saved`) using the same `SearchModeTabs`-style chrome we standardized on Candidates (`bg-[#FAFAF7]` active, no background inactive) — each tab carries its count as a neutral badge after the label · `Sort: AI fit` button (secondary, ghost, with sort icon) and `Select` button (secondary with check-square icon) on the right.

c) The existing `SourcingCandidateTable` renders below, filtered by the selected tab.

Tab filter logic (client-side):
- `All` = current full list.
- `Strong fit` = `match_tier === 'excellent'`.
- `New` = candidates created in the last 7 days (`created_at`).
- `Saved` = bridge into existing saved candidates query (`useSavedCandidates({ projectId })`).

### 3. `src/components/sourcing/SourcingCandidateTable.tsx` — row redesign

Replace the dense single-column body with a card-style row layout while keeping the `Table`/`TableRow` skeleton (so sorting and bulk-select stay). Each row renders one large cell with the new layout:

```text
[ ☐ ] [Avatar]  Name  [Status badge]                           AI FIT
                Senior Product Designer at Figma                  94
                · loc · 8y exp. · Active 2d · @ LinkedIn
                ✓Skill ✓Skill ✓Skill ✓Skill +N
                [Add to job] [Reach out] [Save] [@View profile]       👎  ⋯
```

Concrete styling:
- Row container: white bg, `rounded-xl`, `border border-border`, `p-4 gap-3`, `hover:bg-[#FAFAF7]` (table hover token), no shadow.
- Avatar: 44px, `bg-virgilio-purple text-white`, Poppins semibold initials.
- Name: `text-[15px] font-semibold text-text-primary`, with inline status badge after the name:
  - `In project` → `<Badge tone="lilac" size="xs" dot>In project</Badge>` (when `candidate.candidate_id` exists / already saved).
  - `Contacted` → `<Badge tone="green" size="xs" dot>Contacted</Badge>` (when contacted flag exists; otherwise omit).
- Role line: `text-body-md text-text-primary`, format `Role at Company` (Company still linked to LinkedIn search).
- Meta dots: `text-body-sm text-text-tertiary`, separated by `·`, items: location (MapPin), `Xy exp.` (Briefcase), `Active Xd ago` (Activity), `@ LinkedIn` (link icon) when LinkedIn URL exists.
- Skill chips: matched keywords → `Badge tone="green" size="xs"` with leading `Check` icon; remaining skills → `Badge tone="neutral" size="xs"`. Cap at 5; overflow via `+N`.
- Action row: `<Button variant="primary" size="sm" icon={UserPlus}>Add to job</Button>`, `<Button variant="secondary" size="sm" icon={Mail}>Reach out</Button>`, `<Button variant="secondary" size="sm" icon={Bookmark}>Save</Button>` (becomes `Saved` filled when saved), `<Button variant="ghost" size="sm" icon={AtSign}>View profile</Button>`. For Apollo previews keep the `Reveal (1 credit)` button in place of `Add to job`.
- AI FIT block (right side, vertical, ~80px wide): `text-[10.5px] uppercase tracking-wider text-text-tertiary` label `AI FIT`, big number `text-[28px] font-poppins font-semibold` colored by tier (`excellent` → `text-green-600`, `good` → `text-emerald-600`, `fair` → `text-amber-600`, `minimal` → `text-text-tertiary`).
- Bottom-right corner: thumbs-down ghost icon button + kebab menu (existing actions: hide, report, etc. — wire only to the kebab; thumbs-down can stay no-op for now).
- Selected/active row keeps the 2px purple left rail token from the Tables foundation.

Pagination: swap the `Page X of Y` block for `TableFooterSummary` (the same primitive Candidates and Jobs use) — `Showing X–Y of Z candidates`, plus the existing prev/next buttons inline on the right.

### 4. `src/components/sourcing/CandidateTableSkeleton.tsx` — match new row height

Bump skeleton heights so the new card-style rows don't pop when data loads.

## Out of scope

- `ConversationTab`, `SavedCandidatesTab`, `ArchivedCandidatesTab` internals — only navigation/entry points change.
- Profile sheet, enrichment, bulk collect, saved/archive mutations.
- New search empty state, FilterPanel, page shell — already aligned.

## Technical notes

- AI summary counts: derive from `candidates` array client-side; `sourceBreakdown` is already passed through from `useSourcingProjectCandidates`.
- `New` filter: gate on `created_at` within last 7 days, fallback to all if `created_at` missing.
- Tab strip reuses the `SearchModeTabs` pattern but ships as a small local component inside `CandidatesTab` (no new shared primitive yet — promote later if reused).
- Badge tones use the global compositional `<Badge>` API per the style guide; no ad-hoc color classes.
