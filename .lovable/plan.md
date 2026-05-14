## Audit findings

The previous pass updated the *foundation* (`Select`, `DropdownMenu`, `Popover`, `Command`, `FilterChipPopover`, `DatePickerVirgilio`) but several surfaces still ship legacy chrome and bypass the new tokens.

### Surfaces that still violate §5

**Bespoke popover panels** (custom paddings/widths/typography, ignore `menuPanel`/`menuItem`):
- `src/components/layout/GlobalCreateButton.tsx` — `DropdownMenuContent w-56` with custom oversized rows + own group label styling
- `src/components/layout/Header.tsx` — avatar menu + secondary action menu, `shadow-calendly border-virgilio-border` legacy classes, custom item heights
- `src/components/layout/NotificationCenter.tsx` — fully custom `PopoverContent w-[440px]` (legacy shadow, header/divider styles, sticky group label using old token names)
- `src/components/layout/MobileBottomNav.tsx` — `shadow-calendly` legacy class
- `src/components/jobs/JobsTable.tsx` — row action menu with hand-rolled item classes
- `src/components/ui/searchable-select.tsx` — uses `Popover` + `cmdk`, but item classes are inline, no `menuItem`
- `src/components/ui/filter-chip-select.tsx` — own item layout, no chrome tokens
- `src/components/ui/currency-select.tsx` — bespoke item rendering
- `src/components/ui/month-picker.tsx` — old border/typography
- `src/components/ui/split-button.tsx` — verify uses tokens

**Calendar / date pickers** (still on legacy `react-day-picker` styling, do not match §5 date-picker spec):
- `src/components/ui/calendar.tsx` — base shadcn calendar, uses `text-muted-foreground`, `bg-accent`, 36px cells, no Today/Tomorrow/Next-week row, no purple-30 ring on today
- Direct `<Calendar>` consumers that should either adopt the restyled calendar or migrate to `DatePickerVirgilio`:
  - `src/components/analytics/AnalyticsTimeFilter.tsx`
  - `src/components/candidates/BulkEmailDialog.tsx` (schedule-send date)
  - `src/components/candidates/CandidateFiltersPanel.tsx` (two date range fields)
- `src/components/ui/datetime-picker-virgilio.tsx` — already composes the new picker, just confirm visuals after calendar restyle

**Filters on the Jobs page**: `src/components/jobs/JobsTable.tsx` toolbar + the underlying `<FilterChipPopover>`/`<FilterChipSelect>`/`<SearchableSelect>` — covered once the three primitives above are normalized.

## What I'll change

### 1. Restyle the shared `Calendar` primitive (`src/components/ui/calendar.tsx`)
Bring it in line with `DatePickerVirgilio`'s grid so every consumer of shadcn `<Calendar>` automatically follows §5:
- 32px day cells, radius 8, Inter 12.5px
- `day_selected` → `bg-virgilio-purple text-white`
- `day_today` (unselected) → `ring-1 ring-virgilio-purple/30`
- `head_cell` → `text-menu-group uppercase text-[hsl(var(--menu-group-color))]`
- Hover → `bg-[hsl(var(--menu-hover))]`
- Disabled → `opacity-45`
- Focus ring → `ring-virgilio-purple/30`
This fixes AnalyticsTimeFilter, BulkEmailDialog, CandidateFiltersPanel without touching them.

### 2. Normalize bespoke menu surfaces to use shared tokens
In each file below, replace inline classes with `menuPanel` chrome (already applied automatically via the updated `DropdownMenuContent`/`PopoverContent`) and swap legacy `shadow-calendly border-virgilio-border w-…` props for sizing only:
- `GlobalCreateButton.tsx` — items use `menuItem`, group label uses `menuGroupLabel`, separator via `<DropdownMenuSeparator>`, danger-style only when applicable
- `Header.tsx` — avatar + secondary menus: drop `shadow-calendly border-virgilio-border`, remove custom item paddings, sign-out becomes last item after separator with destructive tone
- `NotificationCenter.tsx` — rebuild panel to spec: 4px pad container retained but inner header uses §5 hairline (`menuSeparator`), group labels use `menuGroupLabel` tokens, drop legacy `shadow-calendly`, swap `bg-virgilio-purple/10` row hover for `bg-[hsl(var(--menu-hover))]`, badge uses lilac selection token; keep 440px width per spec exception (notification panel is wider than menu)
- `MobileBottomNav.tsx` — drop `shadow-calendly border-virgilio-border`
- `JobsTable.tsx` — items use `menuItem`; danger row last after `<DropdownMenuSeparator>`

### 3. Normalize remaining UI primitives
- `searchable-select.tsx` — `CommandItem` already gets `menuItem` from updated `command.tsx`; remove inline overrides; ensure `PopoverContent` has no extra padding (it inherits new chrome)
- `filter-chip-select.tsx` — `DropdownMenuItem` inherits `menuItem`; remove custom inline classes; check icon goes right
- `currency-select.tsx` — same treatment, items via `menuItem`
- `month-picker.tsx` — remove `border-t pt-3` legacy divider, use `menuSeparator`; quick-pick row matches DatePickerVirgilio's quick-pick row

### 4. Documentation + memory
- Update `docs/style-guide.md` §5 with a note that the shadcn `<Calendar>` primitive itself now follows the date-picker spec
- Update `mem://style/dropdowns/foundation-v1` to mention Calendar primitive coverage

### Out of scope
- Public-facing booking calendar visuals (`PublicBookingPage`) — has its own brand canvas
- Rich-text editor floating toolbars (`rich-text-editor.tsx`) — different system (toolbar, not a menu)
- Phone-input country popover beyond inheriting the new chrome
- No API/prop changes on any component

### Verification
- Open Jobs page → click `+` create button, header avatar, notification bell, jobs row `⋯`, candidate filters date range, analytics time filter, bulk-email schedule date — all should render identical chrome (radius 12, 4px pad, soft shadow, 30px rows, hover #F1F0EC, lilac selected) and the calendar grid should match the DatePickerVirgilio look.
- Settings → Style Guide → Dropdowns panel still renders without overrides.

Ready to implement on approval.