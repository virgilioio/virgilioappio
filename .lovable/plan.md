## Adopt Gio Foundation §5 — Dropdowns

Codify the dropdown spec from the screenshot as a new section of `docs/style-guide.md`, retrofit our shared primitives to match it, and remove dead legacy code. **Public APIs of every primitive stay the same** — every existing call site (`<Select>`, `<DropdownMenu>`, `<Popover>`, `<SearchableSelect>`, `<DatePickerVirgilio>`, `<CurrencySelect>`, `<FilterChipPopover>`, etc.) keeps working untouched. We retrofit the chrome inside.

### 1. Add §5 Dropdowns to `docs/style-guide.md`

New section after §4 Tables. Spec captured from the screenshot:

**Three rules**
1. **Match width to content, not container.** Single-select matches trigger width. Action menus = longest label + 24px. Command palette 540–640px.
2. **One density: 30px row · 12.5px label.** Headings (10px uppercase) and dividers thin the visual weight — they don't shrink rows.
3. **Search appears at 7+ items.** <7: plain list. 7–50: search header. 50+: full combobox with virtualization.

**Anatomy** — one panel chrome reused across all six types: radius 12 · pad 4 · shadow `12px 32px -8px rgb(0 0 0 / 0.18)` · group label 10px Inter caps `#8B8F9E` · hover `#F1F0EC` · selected `#EDE4FF` · danger items always last after a divider · kbd hints right-aligned.

**Six types** — pick the simplest that fits:

| Type | When | Notes |
|---|---|---|
| Single-select dropdown | Status, role, owner, country | Width matches trigger · `<Select>` |
| Multi-select with checkboxes | Filter rows by multiple values | Footer with selection count + Clear + Apply · `<FilterChipPopover>` |
| Combobox (search-in) | Pick from large set — candidates, jobs | Search header always · async loading · empty/loading states · `<SearchableSelect>` |
| Action menu (⋯) | Row actions, more menus | Anchored to icon button · destructive last after divider · `<DropdownMenu>` |
| Command palette (⌘K) | Jump-anywhere | Full-bleed search · grouped sections · kbd hints · live counts · 540–640px · `<Command>` |
| Date picker | Date input | Quick-pick row (Today / Tomorrow / Next week) + 7-col month grid · `<DatePickerVirgilio>` |

**Item states** — five fills, same row height: Default · Hovered (`#F1F0EC`) · Selected single (`#EDE4FF` + check) · Disabled (45% opacity) · Danger (red text). Variants: with sub-text (two-line), with badge (right-aligned count chip), with kbd (right-aligned mono shortcut).

**Anchoring** — `bottom-start` is default. Flip to `top-start` on clip. Action menus use `bottom-end` + 8px offset so the menu doesn't cover the row.

**Tokens** to add in `index.css`:
```css
--menu-radius: 12px;
--menu-pad: 4px;
--menu-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.18);
--menu-item-h: 30px;
--menu-item-text: 12.5px;
--menu-group-label: 10px;
--menu-group-color: #8B8F9E;
--menu-hover:    40 14% 93%;     /* #F1F0EC */
--menu-selected: 264 73% 95%;    /* #EDE4FF */
```

Typography utilities to add in `tailwind.config.ts`: `text-menu-item` (12.5/Inter/400), `text-menu-group` (10/Inter/500/+0.08em/uppercase), `text-menu-kbd` (11/Mono).

### 2. Retrofit primitives — chrome only, APIs untouched

Files edited under `src/components/ui/`:

- **`select.tsx`** — `SelectContent` adopts `--menu-radius`, `--menu-shadow`, `p-1`. `SelectItem` → 30px h, 12.5px text, hover/selected use new tokens. `SelectLabel` → uppercase 10px caps `#8B8F9E`.
- **`dropdown-menu.tsx`** — same chrome on `DropdownMenuContent` / `Sub`. `DropdownMenuItem` → 30px/12.5px. `DropdownMenuShortcut` already right-aligns; restyle to `text-menu-kbd`. New optional `inset` for danger via the existing destructive className.
- **`popover.tsx`** — only chrome (radius 12 · shadow · pad 4) so menus opened in popovers (filter pills, date picker) match.
- **`command.tsx`** — `CommandInput` becomes the full-bleed search header; min-w 540 / max-w 640 on the wrapper; `CommandGroup` heading uses `text-menu-group`; items 30px/12.5px; right-aligned kbd hint slot.
- **`searchable-select.tsx`** — combobox shell (search header always, empty + loading states already exist) restyled to the same chrome.
- **`multi-select.tsx`** — **delete file** (0 callers). `<FilterChipPopover>` already implements the checkbox + Clear/Apply footer per spec.
- **`filter-chip-popover.tsx`** — checkbox row 30px, label 12.5px, footer height fixed, Clear = `variant="ghost"`, Apply = `variant="primary"` `size="sm"`.
- **`filter-chip-select.tsx`** — share chrome with `select.tsx`.
- **`date-picker-virgilio.tsx`** — confirm Today/Tomorrow/Next week pills sit above the 7-col grid in the new chrome; selected day uses `--menu-selected`. Apply button uses primary `size="sm"`. No date-logic changes.
- **`datetime-picker-virgilio.tsx`** — same chrome only.
- **`currency-select.tsx`** — re-skin via the new combobox chrome.

Refactor approach: extract a `menuPanel` and `menuItem` className constant in `src/lib/utils.ts` (or a new `src/lib/menu-classes.ts`) so all 10 primitives stay in lockstep — single source of truth in one place.

### 3. Delete dead legacy

- `src/components/ui/multi-select.tsx` (0 imports — confirmed via project grep).
- Inline call-site overrides for menu chrome that hard-code `rounded-md`, `shadow-lg`, `bg-popover`, etc. — search and remove only the ones that fight the new tokens. Surface-level audit, not a refactor of business logic.

### 4. Out of scope (don't touch)

- Public APIs / props of any primitive.
- Call-site logic — every `<Select>`, `<DropdownMenu>`, `<DatePickerVirgilio>` etc. keeps its existing data and handlers.
- Page-specific menus (PipelineSectionTabs, ProfileStageStrip, sidebar) — they're tab strips, not dropdowns.
- New component types beyond the six the spec defines.

### Verification

After edits: visual check on (a) Settings → Style Guide (add a new `<DropdownsGuide>` panel under `StyleGuide.tsx` mirroring the screenshot — Anatomy, the six Types, Item states, Anchoring), (b) Jobs page filters (`<FilterChipPopover>`), (c) any candidate row `⋯` action menu (`<DropdownMenu>`), (d) Find page autocomplete (`<SearchableSelect>`), (e) interview scheduler date input (`<DatePickerVirgilio>`).

### Memory updates after merge

- New core line: "Dropdowns: one chrome — radius 12 · pad 4 · shadow 12/32/-8 · 30h items · 12.5px label · hover #F1F0EC · selected #EDE4FF · danger last. Six types — single-select, multi-select+Apply, combobox, action menu, command palette, date picker. Spec: `docs/style-guide.md` §5."
- Add memory: `mem://style/dropdowns/foundation-v1` describing the six types and the menu tokens.
