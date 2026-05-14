# Buttons — gap to Gio v1.0 spec

Comparison against `00_Buttons.html`. Existing system (`src/components/ui/button.tsx`, `docs/style-guide.md` §2, height tokens in `src/index.css` + `tailwind.config.ts`) is ~80% there. Variants, sizes, height tokens, loading width-lock, danger/dangerSolid split, and on-dark variants already match.

What's missing or off:

## A — Base styling drift

| # | Spec | We have | Action |
|---|------|---------|--------|
| 1 | `tracking-[-0.005em]` on every button | not set | add to base CVA |
| 2 | Focus ring: `ring-2 ring-virgilio-purple/30 ring-offset-0` | `/35` + `ring-offset-2` | retune to spec (no offset, 30%) |
| 3 | Active: "filled variants darken further, shadow drops" — no translate | `active:translate-y-[0.5px] active:shadow-inner` | drop the translate, keep darken; (style-guide §2 also says +0.5px — fix doc) |
| 4 | Hover tones: secondary → `#FAFAF7`, ghost → `#F1F0EC` (cream-tinted) | `foreground/[0.04]` and `foreground/[0.06]` (cool gray) | swap to cream-tinted tokens |
| 5 | xl text 14px | `text-[15px]` | change to 14 |
| 6 | Icon size 13–15px across sizes | xs 12, sm 14, md 16, lg 16, xl 18 | tighten md → 14 (`size-3.5`), lg → 15, xl → 16 |

## B — Missing API surface

Spec implies prop-driven composition; today it's variant-only and consumers hand-roll icons.

7. **`icon` / `iconRight` props** — accept a `LucideIcon`, render at the size matching the button size, with the spec gap (6px). Removes copy-paste `<Icon className="…" />` everywhere.
8. **`iconOnly` prop** — square button (`w === h`), requires `aria-label` (dev warning if missing). Replaces today's `size="icon|icon-sm|icon-lg"` which mixes "size" and "shape".
9. **`dropdown` prop** — appends a `ChevronDown` at `opacity-65`. Replaces the manual chevron pattern.
10. **`onDark` prop** — collapses `primaryOnDark` / `secondaryOnDark` / `ghostOnDark` into `<Button variant="primary" onDark>`. Keep the three variants as deprecated aliases for one cleanup pass.

## C — Specialty patterns missing

Not part of the base button, but called out by the spec and currently absent:

11. **`<SplitButton>`** — primary action + chevron sidecar that opens a menu of alternatives. Thin composition over `Button` + `DropdownMenu`.
12. **`<ToggleButton>`** — visible-state push (Favorite, Pin, Subscribe), `aria-pressed`, lilac fill in pressed state. Today done ad-hoc per surface.
13. **`<FAB>`** — bottom-right mobile-only floating action, single per screen, md surface raised to lg height. Tiny wrapper with positioning + responsive `hidden md:none`.
14. **Segmented control** — confirm `ToggleGroup` is wired with the spec look (active = white fill + shadow). Adjust if not.

`link` variant and `<Switch>` already cover the spec's "Link button" and "Toggle (single)".

## D — Style guide § 2 updates

Patch `docs/style-guide.md` to reflect A + B + C: tracking value, hover tones, icon size table, drop the translate-on-active line, document `icon` / `iconRight` / `iconOnly` / `dropdown` / `onDark` props, add SplitButton / ToggleButton / FAB rows under "Specialty patterns", and add the **In context** ordering rules (right-aligned in PageHeader, primary rightmost in dialogs, danger-solid only in confirm step). Add the "Do & Don't" pairs from the spec verbatim.

## E — Sweep

15. Replace `variant="primaryOnDark|secondaryOnDark|ghostOnDark"` call sites with `onDark`. Replace ad-hoc `<Button><Icon …/>label</Button>` patterns with `icon={Icon}` where it's a clean swap. Keep aliases until two sweep passes are clean.

## Technical notes

- Base CVA change (point 1–3): one-line edits, won't break any consumer.
- Points 7–10 are additive props — old usage keeps working.
- `iconOnly` will deprecate `size="icon|icon-sm|icon-lg"`; alias them to `iconOnly + size`.
- `onDark` ramp lives as Tailwind variants, not new tokens — top bar already uses `bg-citron-noir`.
- No backend, no schema, no new colors.

## Rollout order

D (doc) → A (base styling, lowest risk) → B (props, additive) → C (new components) → E (sweep). Each phase shippable independently. Want me to start with D + A together so the doc and code land in lockstep?
