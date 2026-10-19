/**
 * Gio Foundation v1.0 §5 — Dropdowns
 * Single source of truth for the chrome shared by every floating menu:
 * <Select>, <DropdownMenu>, <Popover>, <Command>, <SearchableSelect>,
 * <FilterChipPopover>, <DatePickerVirgilio>, <CurrencySelect>.
 *
 * Tokens live in `src/index.css` under `--menu-*`.
 * Spec: `docs/style-guide.md` §5.
 */

/**
 * Panel chrome — Gio Docs' menu (Allan, 2026-10-19): radius 12 · pad 4 · the
 * --shadow-menu ring instead of a border. Motion & Feel (CLAUDE.md §2):
 * `gio-pop` (src/index.css) grows the panel from its trigger — scale 0.96 +
 * fade, 180ms in / 120ms out.
 */
export const menuPanel =
  'rounded-[var(--menu-radius)] bg-popover text-popover-foreground p-[var(--menu-pad)] shadow-menu gio-pop'

/**
 * Item row — Gio Docs' row: 28px min (4px 8px), 14px Inter on a 20px line,
 * radius 6, 8px gap; a leading icon is drawn 20px at a 1.6 stroke and a tick or
 * chevron sits at the end (`gio-mrow`, src/index.css MENUS). Hover #F1F0EC; a
 * chosen option shows its tick, never a fill; disabled rows turn faint.
 * Use the `data-[disabled]` selectors that Radix sets automatically.
 */
export const menuItem =
  'gio-mrow relative flex w-full cursor-default select-none items-center gap-2 text-left ' +
  'min-h-[var(--menu-item-h)] py-1 px-2 rounded-[var(--menu-item-radius)] ' +
  // No transition: hover and keyboard highlight move instantly (§3, §7).
  'font-inter outline-none ' +
  'focus:bg-[hsl(var(--menu-hover))] focus:text-foreground ' +
  'data-[highlighted]:bg-[hsl(var(--menu-hover))] data-[highlighted]:text-foreground ' +
  'data-[selected=true]:bg-[hsl(var(--menu-hover))] data-[selected=true]:text-foreground ' +
  // cmdk emits data-disabled="false" on enabled items, so we must match exact
  // values rather than mere attribute presence. Radix sets data-disabled="" when disabled.
  "data-[disabled=true]:pointer-events-none data-[disabled=true]:text-[hsl(var(--menu-group-color))] " +
  "data-[disabled='']:pointer-events-none data-[disabled='']:text-[hsl(var(--menu-group-color))]"

/** Danger item (Delete and friends) — always last after a separator; neutral
 *  until pointed at or focused, then red (MENUS in src/index.css). */
export const menuItemDanger = 'text-destructive'

/** Section header — Gio Docs': 12px sentence case on a 28px line, faint. */
// The colours are written as [color:…] so tailwind-merge (cn) doesn't take them
// for the text-menu-* size and drop the size.
export const menuGroupLabel =
  'flex min-h-[28px] items-center px-2 py-1 text-menu-head font-inter ' +
  '[color:hsl(var(--menu-group-color))]'

/** Right-aligned shortcut or value inside an item — the UI font at 12px, faint. */
export const menuKbd =
  'ml-auto flex max-w-[112px] shrink-0 items-center gap-0.5 overflow-hidden whitespace-nowrap pl-2 ' +
  'text-menu-kbd font-inter tabular-nums [color:hsl(var(--menu-group-color))]'

/** Hairline divider between item clusters, inset 8px from the panel's edges. */
export const menuSeparator =
  'mx-2 my-1 h-px bg-[hsl(var(--tbl-divider-color))]'

/** Command palette outer shell — full-bleed search, 540–640px wide. */
export const menuCommandShell =
  'min-w-[var(--menu-cmd-min-w)] max-w-[var(--menu-cmd-max-w)]'
