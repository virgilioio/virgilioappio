## Audit findings — filter chips

The popover *panel* of `FilterChipPopover` already follows §5 (uses `menu-*` tokens, `menuItem` row sizing, hover/selected colors, group label). The mismatch is in the **trigger chip** itself.

`FilterChipPopover` has two trigger styles:
- **`soft`** (rounded-lg, white + hairline, lilac-purple count) — used **only by Jobs** (`JobsTable.tsx`)
- **`pill`** (rounded-full, accent-tinted, default) — used everywhere else

Files still on the legacy `pill` style:
- `src/components/candidates/CandidateFiltersPanel.tsx` (9 chips)
- `src/components/analytics/AnalyticsFiltersBar.tsx` (4 chips)
- `src/components/talent-intelligence/TalentIntelligenceFilterBar.tsx` (8 chips)
- `src/components/pipeline/FilterCard.tsx` (3 chips)
- `src/components/organizations/OrganizationsTable.tsx` (1 chip)
- `src/components/members/MembersTable.tsx` (3 chips)
- `src/components/settings/IntegrationsTab.tsx` (2 chips)
- `src/pages/Deals.tsx` (2 popover chips + 1 `FilterChipSelect`)

`FilterChipSelect` is hard-coded to the legacy pill look (no variant prop) — used in `Deals.tsx`.

## What I'll change (UI-only, zero API breakage)

### 1. Promote `soft` to the default in `FilterChipPopover`
- Flip default `variant = 'soft'` in `src/components/ui/filter-chip-popover.tsx`
- Remove the legacy `pill` branch entirely (no caller passes it explicitly)
- Drop `variant` from the prop type
- Result: every existing call site automatically gets the Jobs-page chip look

### 2. Restyle `FilterChipSelect` to match the Jobs chip
- Replace the hard-coded `rounded-full border accent` chip in `src/components/ui/filter-chip-select.tsx` with the same trigger as the soft popover: `h-9 px-3.5 rounded-lg border-virgilio-border bg-white hover:bg-[#FAFAF7]`, `text-text-primary` label · `text-text-tertiary` divider `·` · `text-virgilio-purple` value
- Active state mirrors `soft` (bg `#FAFAF7`)

### 3. Re-align trigger metrics with §5 menu tokens (still on the chip itself)
- Active dot/divider color uses `--menu-group-color` (#8B8F9E) instead of `text-text-tertiary` for consistency with the panel
- Hover background uses `bg-[hsl(var(--menu-hover))]` (#F1F0EC) — already the case via `#F1F0EC` literal; replace with token

### 4. Remove the `variant` prop usage from `JobsTable.tsx`
- Now redundant since `soft` is default; tidy four call sites

### 5. Documentation & memory
- Note in `docs/style-guide.md` §5: "Filter chips use the soft chip variant by default; the legacy pill variant is removed."
- Update the dropdowns memory entry to mention chip trigger conformance.

### Out of scope
- The `<TableFilterPills>` removable pills — those are passive labels, not interactive triggers, and already match the badge system
- Mobile filter drawer chrome (Sheet) — different surface, has its own spec
- Date-range filters inside `CandidateFiltersPanel` — already inherit the new shadcn `Calendar` styling from the previous pass
- No business-logic, prop-shape, or onChange changes

### Verification
- Open Jobs, Candidates, Analytics, Talent Intelligence, Pipeline, Organizations, Members, Settings → Integrations, Deals — all filter rows render the same rounded-lg white-hairline chip, with lilac active count and identical popover panel.

Ready to implement on approval.