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
 * Panel chrome — radius 12 · pad 4 · shadow 12/32/-8 black/18.
 * Always paired with `bg-popover text-popover-foreground` and a 1px hairline border.
 */
export const menuPanel =
  'rounded-[var(--menu-radius)] border border-border bg-popover text-popover-foreground p-[var(--menu-pad)] shadow-[var(--menu-shadow)] ' +
  // Radix open/close animations — preserved from shadcn defaults.
  'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 ' +
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'

/**
 * Item row — 30px h · 12.5px Inter · radius 8.
 * Hover #F1F0EC, selected #EDE4FF, disabled 45% opacity.
 * Use the `data-[disabled]` selectors that Radix sets automatically.
 */
export const menuItem =
  'relative flex cursor-default select-none items-center gap-2 ' +
  'h-[var(--menu-item-h)] px-2 rounded-[var(--menu-item-radius)] ' +
  'text-menu-item font-inter outline-none transition-colors ' +
  'focus:bg-[hsl(var(--menu-hover))] focus:text-foreground ' +
  'data-[highlighted]:bg-[hsl(var(--menu-hover))] data-[highlighted]:text-foreground ' +
  'data-[state=checked]:bg-[hsl(var(--menu-selected))] data-[state=checked]:text-foreground ' +
  'data-[selected=true]:bg-[hsl(var(--menu-hover))] data-[selected=true]:text-foreground ' +
  // cmdk emits data-disabled="false" on enabled items, so we must match exact
  // values rather than mere attribute presence. Radix sets data-disabled="" when disabled.
  "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45 " +
  "data-[disabled='']:pointer-events-none data-[disabled='']:opacity-45"

/** Danger item — always last after a separator. */
export const menuItemDanger =
  'text-destructive focus:bg-destructive/10 focus:text-destructive ' +
  'data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive'

/** Section heading — 10px Inter caps `#8B8F9E`, +0.08em tracking. */
export const menuGroupLabel =
  'px-2 pt-2 pb-1 text-menu-group font-inter uppercase ' +
  'text-[hsl(var(--menu-group-color))]'

/** Right-aligned keyboard hint inside an item. */
export const menuKbd =
  'ml-auto flex items-center gap-0.5 text-menu-kbd font-mono ' +
  'text-[hsl(var(--menu-group-color))]'

/** Hairline divider between item clusters. */
export const menuSeparator =
  '-mx-[var(--menu-pad)] my-1 h-px bg-[hsl(var(--tbl-divider-color))]'

/** Command palette outer shell — full-bleed search, 540–640px wide. */
export const menuCommandShell =
  'min-w-[var(--menu-cmd-min-w)] max-w-[var(--menu-cmd-max-w)]'
