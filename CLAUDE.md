# Gio ATS — Motion & Feel rules

Gio ATS is Virgilio's applicant tracking system (Vite, React 18, React Router 6, Tailwind 3, shadcn/ui on Radix, Supabase project `etrxjxstjfcozdjumfsj`). These rules govern **motion, feel and robustness**. They were adopted from Gio Sales on 2026-10-09 (Block B §1–§15, approved by Allan 2026-10-08). The architecture notes in `AGENTS.md` still apply and win on behaviour.

## Scope and precedence
- **The ATS keeps its own visual identity.** Colours, fonts, sizes, spacing, radii, borders, layout and copy don't change. Gio Sales' visual amendments (its fonts, colour tokens, the three-shadows rule) don't carry over. Only timing, easing, transform origins, press states, state handling and edge cases change. The one visual exception is the Block B one: menus, popovers and hover cards swap a solid border for `--shadow-pop`.
- **Behaviour contracts stay.** Gio Sales ↔ ATS sync, Mark hired / unhire, openings and Req IDs, the draft→open publish gate, draft auto-save and role assignment keep working exactly as they do. Motion changes are presentational, except where §5 changes when the UI updates (optimistic updates and Undo).
- **New feature designs never override what's built.** When a design clashes with these rules or with a primitive listed in the Implementation map, the rule wins and the design value is mapped onto it; list the mappings in the feature's report.
- **The ATS is responsive.** Unlike Gio Sales it has a phone layout and public pages for candidates, referees and clients, so the touch rules (§4 long-press, §9 swipe-to-dismiss, §12 16px inputs on phones) apply in full.
- **Dark mode is not live** (no theme provider mounted). Don't add or remove `dark:` styles; leave it as it is.
- **No new animation libraries.** CSS transitions, the Web Animations API, `tailwindcss-animate` and Radix data-state hooks. The one existing `motion` import (`ai-elements/shimmer.tsx`) stays; don't add more.

## Decisions (Allan, 2026-10-09)
- **Built directly in the repo** by Claude, tested against intercepted fake data, merged to `main`; Lovable syncs from GitHub. One component or pattern per commit.
- **One toast system:** Sonner, bottom-left. The old Radix `use-toast` API keeps working through an adapter, so call sites don't change. One toast at a time; Undo lives in the toast's action.
- **Deletes:** records keep a confirmation dialog (and `confirm()` boxes become that dialog); missing confirmations get added; Undo only where the action is genuinely reversible (archive, status changes, dismissals, delayed commits) — never a re-insert faked after a hard delete. Jobs, candidates and team assignments stay hard-deleted for now — no schema change.
- **Bugs before motion:** the audit's bugs were fixed first (merged 2026-10-09, see `.lovable/reports/motion-audit.md`).

## Implementation map
Shared primitives as they land. New components use these; don't add per-component animation classes.
- **Tokens** — `:root` in `src/index.css`, mapped in `tailwind.config.ts` (`ease-out`, `ease-in-out`, `ease-drawer`, `ease-spring`; `duration-press`, `duration-hover`, `duration-menu-in`, …; `shadow-pop`, `shadow-lift`). Reduced-motion base layer at the end of `src/index.css`.
- **`gio-pressable`** — the Button primitive and every pressable: scale 0.97 on press. **`gio-field`** — Input, Textarea, PlaceholderInput: colour/shadow only, focus border `--input-border-focus` + `shadow-input`.
- **`menuPanel` / `gio-pop`** (`src/lib/menu-classes.ts`) — DropdownMenu, Popover, Select, Command popovers, tag/filter popovers: grow from the trigger, `shadow-pop`, no border. **`gio-context-menu`** — right-click menus, no animation.
- **`TooltipProvider`** (`src/components/ui/tooltip.tsx`) — fixed 400/400ms; nested providers can't override. **`gio-tip`** on TooltipContent. No native `title` on a control that has a tooltip.
- **`gio-dialog` + `gio-dialog-overlay`** — Dialog, AlertDialog (centred with the `translate` property). **`gio-static`** — the command dialog and top-bar search results: no animation.
- **`gio-drawer`** — Sheet (needs `data-side`, set by SheetContent).
- **Toasts** — Sonner only (`src/components/ui/sonner.tsx`, styled under `.gio-toaster` in `src/index.css`); `useToast()` / `toast({...})` from `@/hooks/use-toast` forward to it. Undo = an element with `onClick` passed as `action`, or Sonner's `action: { label, onClick }`.
- **`TabsList indicator="pill" | "underline" | "none"`** (`src/components/ui/tabs.tsx`) — one moving `.gio-tab-indicator`; triggers never draw their own active fill. **Segmented controls** (hand-rolled option groups): `useSegmentLayer()` ref + `gio-seg` on the container, `data-seg-option` + `data-active` on each option (no active background of its own), `<SegmentLayer fill shadow />` last; per-option colours via `data-seg-fill` (`ui/segmented.tsx`).
- **`gio-switch`**, **`gio-accordion-content`** (AccordionContent, CollapsibleContent — caller's className styles an inner `[data-disclosure-inner]`), **`gio-disclosure-chevron`**.
- **Focus** — a global `:focus-visible` rule at the end of `src/index.css` draws the 2px purple outline on every control; don't add `focus-visible:ring-*` to new controls.
- **Hover** — Tailwind `future.hoverOnlyWhenSupported`: `hover:` styles apply only on mouse/trackpad.
- **Tables** — `useSortableTable` returns `bodyRef` (put it on `<TableBody ref={bodyRef}>`): rows FLIP on sort (240ms, skipped above 60 rows and under reduced motion). `SortableHeader` draws one `gio-sort-arrow` that rotates, plus `aria-sort`. `Table` sets `data-scrolled` for the sticky-header shadow; `TableRow` hover is instant; `TableCell` is `tabular-nums`. A card around a sticky table uses `overflow-clip`, never `overflow-hidden`.
- **Boards** (`src/lib/boardMotion.tsx`) — every dnd-kit board: draggables carry `data-board-card={id}`, `touch-action: pan-y` and the `gio-board-slot` class while dragging (dashed slot, same size; `--board-slot-radius` for non-10px cards); the DragOverlay copy sits in `<BoardLift>`; `<DragOverlay dropAnimation={boardDropAnimation()}>`; `useBoardFlip(boardRef, state)` → call `captureBoard([activeId])` right before the optimistic move; `onDragCancel` clears the active id; TouchSensor `{ delay: 350, tolerance: 8 }`. Used by `PipelineOverview` (job board) and `InlineKanban` (/pipeline).
- **Dashboards** — `Skeleton` (`ui/skeleton.tsx`, `gio-shimmer`: 1.2s linear) sized like the content; `Loadable` (`ui/loadable.tsx`) crossfades content in over it, never a lone spinner for a content area. KPIs use `BlendNumber` (`ui/blend-number.tsx`) with a stable `id` (or `MetricCard countId`, `MetricStrip id`): count-up once per session, blend afterwards. Hand-built bars sit in `ChartMotion` (`ui/chart-motion.tsx`, `data-chart-bar={stableKey}`, `axis="x"|"y"`); recharts series spread `useRechartsMotion(id, data, { bars })` (`src/lib/chartMotion.ts`) — `.bar` on Bar, `.series` on Line/Area/Pie, `ref` on a wrapper. Keep the previous data on screen through a refetch so numbers blend and bars morph. Hand-built SVG lines morph in rAF (`analytics/widgets/charts/LineChart.tsx`, `easingFunction()`). Spinners turn at 600ms. Motion tokens in TS: `motionToken()` from `src/lib/motion.ts`.
- **Forms** — `FormField` (`ui/form-field.tsx`) reserves an 18px message line whenever the caller passes an `error` prop, and `FormMessage` always does (`.gio-field-message`, enters 3px down at --dur-hover); `Input`/`Textarea` turn red on `aria-invalid`. On an invalid submit call `shakeFirstInvalid(scope)` (`src/lib/motion.ts`, e.g. react-hook-form's `handleSubmit(onValid, () => shakeFirstInvalid())`). `CommandList` keeps its opening height; menu/option highlight never transitions. Date pickers: `useMonthSlide` (Calendar is six fixed weeks); wizards: `useStepSlide(ref, step)`. Chips: `useChipMotion()` ref on the container + `data-chip={key}` on each chip. Saving: pass `loading` to `Button` (never swap the label to "Saving…"); it keeps its width. Copy buttons: `IconSwap` / `makeSwapIcon(Copy, Check)` + `data-swapped`, reset after 1.6s. `Textarea` auto-grows to 160px then scrolls (on by default, `autoGrow={false}` opts out). Counters: `CharCounterLine` / `CharCounter` (`ui/char-counter.tsx`), never a count written into hint text. Affixes: `AffixInput` (`ui/affix-input.tsx`, `prefix`, `suffix`, `numeric`). Async checks: `useAsyncValidation(key, check)` (`src/hooks/useAsyncValidation.ts`) + `<AsyncStatus>` (`ui/async-status.tsx`). Search: results 150ms after typing stops, icon becomes a 13px `gio-spinner gio-spinner-current`, clear button `.gio-search-clear`, results box fixed height (`GlobalSearchBar`, `GlobalSearchPanel`).
- **Navigation** — pages and Sections never fade in on a route change (no `animate-fade-in` on page roots). `SelectionBar` (`shared/SelectionBar.tsx`) is the bulk bar: fixed over the content, rises 8px in (--dur-dialog-in) and sinks out (--dur-dialog-out). New notification rows use `.gio-open-space` (grid rows 0fr → 1fr, then fade). Progress and stepper fills are full width with `.gio-progress-fill` + `transform: scaleX(p)`, never a width transition. Icon-only controls get `IconTip` (`ui/tooltip.tsx`), never a native `title`.
- **States** — confirmations: `await confirmDialog({ title, description, confirmLabel, destructive })` (`ui/confirm-dialog.tsx`, host in App.tsx), never `window.confirm`; focus starts on Cancel. Optimistic board moves revert with FLIP + `flashRevert()` (`src/lib/boardMotion.tsx`) and a "Couldn't move … · Retry" toast. `OfflineBanner` (layout) slides over the top. `Avatar` fades the image in over same-size initials. Never show a count as 0 while it's still loading.
- **Scale** — tables that can pass 150 rows use `useTableWindow` (`src/lib/useTableWindow.tsx`: spacer rows, only rows in view render); board columns and list groups past 100 add `gio-cv-card` / `gio-cv-row` (content-visibility). Scroll positions per route/tab/filter: `useScrollMemory(ref, key, ready)` + `rememberValue/recallValue` (`src/lib/scrollMemory.ts`). First-load list stagger: `useFirstLoadStagger(id, ready)` (`src/lib/motion.ts`). Side sheets swipe to dismiss on touch (built into `SheetContent`); add `data-no-swipe` to areas that need horizontal drags.
- **Previews and long text** — `HoverCard` (`ui/hover-card.tsx`) carries the §10 timing (500ms open, 150ms grace, neighbours instant, `gio-hovercard` grow-in); entity previews are `JobPreview` / `CandidatePreview` (`src/components/previews/EntityPreview.tsx`) around a cross-entity link; the card is portalled and never opens on focus. `installAutoTitle` (`src/lib/autoTitle.ts`, mounted in App.tsx) shows cut text in a tooltip — don't hand-add `title` to truncated text. Tab bars that overflow scroll sideways with a 28px fade (automatic in `TabsList`). Buttons never wrap (`whitespace-nowrap` in `buttonVariants`).
- **Worst-case data** — page titles stop at 3 lines (`line-clamp-3`), table titles at one line with a max width, company names at 2 lines; empty names read "Unnamed candidate"; `IdentityCell` initials fall back to the email's first letter, then "?"; money over 1M is compact (`12.45M`) with the exact value in `title`. Phones: fixed-width row parts (funnels, avatar stacks) hide below `sm`/`md`, header toolbars wrap, analytics widgets go full width. Top-bar nav labels show from 1280px. `useIsMobile()` uses the shell's 640px line (`SHELL_BREAKPOINT`); a page laid out with `md:` passes 768. The job pipeline list has a phone layout and is the phone default.
- **Batch 2 (§12–§15)** — text inputs are 16px on phones (global rule in `src/index.css`). Chip inputs: two-step Backspace, Tab/paste make chips. Password eyes and copy icons use `IconSwap`. `DialogContent` animates height changes (`useHeightTransition`, `src/lib/heightTransition.ts`); `SheetContent` steps a lower sheet back when another opens on top. Dirty forms that would lose work on Cancel use `UnsavedGuard` (`ui/unsaved-guard.tsx`) in a `relative` footer. `Checkbox` draws its tick and supports `checked="indeterminate"` — use it on select-all parents. Radio dots grow in. Drop zones: `.gio-dropzone` + `data-drag-over`. The one delight: `claimOpeningFilled` / `burstFrom` / `tintHired` (`src/lib/delight.ts`) in Mark hired only.
- **Empty states for candidate lists (§16)** — `CandidatesEmpty` (`src/components/empty/CandidatesEmpty.tsx`, `size="default" | "compact"`, `onceKey`, `animate`) with `PaperPlaneScene` (the animated `SoftPlane`: 2.8s once, settles on the static graphic, reduced motion static). The job pipeline (`PipelineOverview`) and its sections (`PipelineSectionTable`) are the reference: first-load skeleton in a `Loadable`, `throwOnError` fetches so an error never reads as empty, 15s timeout to Retry, filtered empty with Clear filters, `gio-arrive` (rise + flash) for the first candidate, `gio-empty-leave` for the fading empty state. Empty stage columns on a board with candidates elsewhere stay empty: no illustration, no text (Allan, 2026-10-09).

### 1. Tokens
```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* enter, exit, feedback */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement, tabs, accordion, FLIP */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* sheets, drawers */
--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1); /* drag drop settle only */
--dur-instant: 0ms;      /* keyboard, typing, route change, resize-follow */
--dur-press: 160ms;  --dur-hover: 150ms;  --dur-tooltip: 125ms;
--dur-hovercard: 160ms; /* hover card grow-in */
--dur-board-flip: 200ms;
--dur-board-drop: 280ms;
--dur-menu-in: 180ms;  --dur-menu-out: 120ms;
--dur-dialog-in: 220ms; --dur-dialog-out: 150ms;
--dur-resize: 220ms;   /* column + panel width reset */
--dur-drawer-in: 360ms; --dur-drawer-out: 240ms;
--dur-expand: 240ms;  --dur-move: 240ms;  --dur-chart: 320ms;
--dur-tabs: 260ms;
--dur-switch: 200ms;
--dur-countup: 700ms;
--dur-shake: 300ms;
--dur-progress: 300ms;
--dur-toast: 400ms;   --stagger: 40ms;  --dur-flash: 1200ms; --dur-revert: 600ms;
--stagger-chart: 30ms;
--delay-tooltip: 400ms; --delay-hovercard: 500ms; --grace-hovercard: 150ms;
--delay-longpress: 350ms; --hold-confirm: 1200ms;
--delay-search: 150ms;  --delay-validate: 400ms;  --delay-autosave: 600ms;
--dur-tick: 150ms;  --dur-guard: 180ms;  --hold-repeat-delay: 400ms;  --hold-repeat-min: 50ms;
--input-ring: 0 0 0 3px rgba(13,13,9,.08);  --input-border-focus: #3A3D48;
--shadow-pop: 0 0 0 1px rgba(13,13,9,.06), 0 10px 28px -8px rgba(13,13,9,.18);
--shadow-lift: 0 16px 32px -12px rgba(13,13,9,.32);
```

### 2. Core primitives
- **Button and pressables:** `transform` at `--dur-press` with `--ease-out`, and `scale(0.97)` on `:active`. Hover colour uses `--dur-hover` with `ease`, applied only under `(hover:hover) and (pointer:fine)`.
- **DropdownMenu, Popover, Select, row menus:**
  - Enter from `scale(0.96)` plus opacity 0.
  - Origin is `var(--radix-*-content-transform-origin)`, so it grows from the trigger. A right-aligned ⋯ menu therefore grows from its top-right.
  - 180ms in and 120ms out, both `--ease-out`, with `--shadow-pop` and no solid border.
- **Tooltip:**
  - Opens after `delayDuration` 400 (`skipDelayDuration` 400).
  - Enters from `scale(0.97)` plus opacity at 125ms.
  - Once one tooltip is open, the next one opens instantly with no animation.
  - Icon-only controls use `IconTip`; no native `title`.
- **Dialog and AlertDialog:** overlay fade, content from `scale(0.96)` plus opacity, 220ms in and 150ms out, origin centre.
- **Sheet / drawer:**
  - Slides from `translateX(100%)` with `--ease-drawer`, 360ms in and 240ms out.
  - Uses `visibility:hidden` when closed, so no shadow bleeds onto the page.
- **Toast:**
  - Uses transitions, not keyframes, so the stack moves smoothly.
  - 400ms `ease`. Pause timers on hover and while the tab is hidden.
  - Exits in the same direction it entered.
- **Tabs:** one active layer moves between tabs (clip-path or transform) at 260ms `--ease-in-out`. Never crossfade each tab separately.
- **Switch:** the thumb moves with `transform` at 200ms `--ease-out`, the track colour at 150ms, and the thumb is `scale(0.92)` while pressed.
- **Accordion and Collapsible:**
  - Height animates to the real content size (Radix `--radix-accordion-content-height` or `grid-template-rows: 0fr → 1fr`), 240ms `--ease-in-out`.
  - Content fades in 60ms later.
  - Never use the `max-height` trick.
- **Command palette (⌘K):** no animation, open or close.

### 3. Tables
- **Sort:**
  - Rows FLIP to their new positions at 240ms `--ease-in-out`.
  - The arrow rotates 180° at 200ms `--ease-out`.
  - Pagination and filtering don't animate.
- **Row hover:** instant, mouse-only.
- **Inline edit:**
  - The input matches the cell's text size and height, so the row never changes height.
  - Enter saves, Esc cancels, and blur saves.
  - The saved row flashes `#FBEFC9` fading to transparent over 1200ms.
- **Sticky header:** gains a soft shadow (150ms) only when the table is scrolled.
- **Column and panel resize:**
  - Follows the pointer exactly with no transition, using pointer capture.
  - The handle highlights on hover and while dragging.
  - Double-click resets with a 220ms `--ease-out` animation.
- **Numbers:** `tabular-nums` in every numeric column.

### 4. Boards
- **Pick up:**
  - Lift with `scale(1.03) rotate(1.5deg)` plus `--shadow-lift` at 160ms.
  - The original becomes a dashed slot.
- **Move:** other cards FLIP aside at 200ms. Column counts update live.
- **Drop:** settles into the slot with `--ease-spring` at 280ms.
- **Esc during drag:** returns the card to where it started.
- **Move via menu or arrows:** the card FLIPs across columns at 320ms.
- **Touch:**
  - Long-press (`--delay-longpress`) to pick up. Moving more than 8px first means it's a scroll, not a drag.
  - Use `touch-action: pan-y` on cards, and call `preventDefault` on touchmove only once a card is picked up.
- Throughout: update `transform` directly on the dragged element, never through a CSS variable on its parent.

### 5. States and recovery
- **Optimistic updates:**
  - Update the UI immediately and save in the background.
  - On failure, revert gently with a short red ring on the reverted element, and show "Couldn't … · Retry" in **reserved space**.
  - Never show raw server errors.
- **Undo over confirmation:** for reversible actions (archive, remove from list, move, unassign):
  - The row collapses in 240ms.
  - A snackbar appears with Undo for 5s, and Undo restores the row the same way.
  - Backed by a soft delete or a delayed commit.
- **Hold-to-delete:** only for Delete draft and Archive deal. A linear fill over `--hold-confirm` while held, snapping back in 200ms on release.
- **Empty state to first item:**
  - The container keeps its height.
  - The empty state fades out in 150ms, the first item rises in from 6px plus opacity, then flashes.
- **Offline:**
  - The banner slides over the top in 220ms and never pushes content.
  - On reconnect it turns green ("Back online. All changes saved.") for 1.5s, then slides away.
  - Queue any mutations made while offline.
- **Avatars and logos:**
  - The placeholder (initials) is exactly the image's size.
  - The image fades in over it in 200ms once loaded. Never swap sizes.

### 6. Dashboards
- **Loading:**
  - A skeleton with the exact size of the real content, with a 1.2s linear shimmer.
  - Content crossfades in on top (200ms), so there's no layout shift.
  - Never use a lone spinner for content areas.
- **KPIs:**
  - Count up only on first view per session (700ms `--ease-out`).
  - On a period or filter change, blend through `blur(2px)` plus opacity 0.4 over 180ms. Never count up again.
- **Charts:**
  - Bars grow from the baseline on first load only, with a 30ms stagger.
  - On a period change, they morph to their new values at 320ms `--ease-in-out`.
  - Never fade or re-grow the whole panel.
- **Spinners** (inline only): 600ms per turn, linear.

### 7. Forms and inputs
- **Validation:**
  - Reserve the message line (min-height 18px) so nothing moves.
  - The message enters from `translateY(-3px)` plus opacity in 150ms.
  - The border shifts colour in 150ms.
  - On an invalid submit, the field shakes once (6px, 300ms) and focus returns to it. No shake with reduced motion.
  - Clear the error as soon as the input becomes valid.
- **Combobox:**
  - Fixed list height. No animation on typing or highlight changes.
  - Arrow keys move the highlight instantly.
  - "No results" plus "Create '…'" fill the same box.
- **Date picker:**
  - The popover follows the menu rules (origin from the trigger).
  - Changing month slides the grid 12px in the direction you went, with opacity, at 200ms `--ease-out`.
- **Wizard:**
  - Next slides content in from +16px, Back from −16px, at 220ms `--ease-out`.
  - The progress line moves with `scaleX` at 300ms `--ease-in-out`.
  - The content area keeps its height between steps.
- **Filter chips:**
  - Chips enter from `scale(0.9)` plus opacity in 160ms.
  - On removal they shrink out in 120ms, then their neighbours FLIP over to close the gap (200ms).
- **Save buttons:**
  - Fixed min-width. Labels go Save → Saving… → Saved.
  - Labels blend through `blur(2px)` over 180ms, so the button keeps the same width throughout.
- **Copy chips:**
  - The copy icon shrinks out and the check grows in (150ms, from scale 0.6 with blur 2px), plus press scale.
  - Reset after 1.6s.

### 8. Navigation and system
- **Sidebar collapse:**
  - Width eases over 240ms `--ease-in-out`.
  - Labels are `nowrap` and fade out in 120ms first. Icons never move.
- **Notifications:**
  - A new item opens space (grid rows `0fr → 1fr`, 240ms) and then fades in.
  - The badge pulses once (scale 1 → 1.25 → 1, 300ms).
  - Unread dots fade in 150ms.
- **Stage stepper:** the line moves with `scaleX` at 300ms `--ease-in-out`, and step colours change in 150ms.
- **Focus rings:** use `:focus-visible` only, appear instantly, as a 2px `#6F3FF5` (virgilio-purple) outline at 2px offset, as in Gio Sales. Never animated, never shown on mouse click, never removed.
- **Route and page changes:** no animation.
- **Bulk selection bar:**
  - Floats over reserved space and never pushes content.
  - Rises from 8px plus opacity, 220ms in and 150ms out.

### 9. Scale and touch
- **Long lists:**
  - Virtualise anything that can exceed 500 rows.
  - No enter animation or stagger on scroll.
  - Keep scroll position for each tab, filter and route.
- **List stagger:** first load only, the first 6–8 rows, 40ms apart. Never on re-sort, filter or pagination, and never blocking input.
- **Swipe-to-dismiss** (mobile sheets and toasts):
  - Dismiss when dragged more than 60px, or on a flick faster than 0.11 px/ms.
  - Dragging past the boundary meets increasing resistance (`-sqrt(d)*2`).
  - Settles with `--ease-drawer` at 300ms.

### 10. Previews, language and robustness
- **Hover cards:**
  - Open after `--delay-hovercard`; neighbours then open instantly with no animation.
  - Grow from the trigger (scale 0.97, 160ms).
  - Close after a `--grace-hovercard` grace period, so the pointer can move into the card.
  - Mouse-only. On touch, a tap opens the full page.
- **Translations (EN, DE, IT):** the ATS has no UI translations yet, so this is a long-string stress pass (pseudo-German, +40%).
  - Buttons are `nowrap` and wrap as whole units in their group, with an ellipsis and `title` only as a last resort.
  - Tab bars scroll sideways, with a 28px right-edge fade mask.
  - Never let a button wrap onto two lines.
  - Test with German first, since it has the longest strings.
- **Worst-case data:**
  - Company names over 80 characters, and single-word compounds.
  - Titles over 100 characters.
  - An empty contact name.
  - Emails over 60 characters.
  - Values of €0, €999 and €12,450,000.
  - 148 openings.
  - 9 role chips.
  - 0 items and 10,000 items.
  - Multi-line Key Takeaways.
- **How to handle it:**
  - Company names clamp to 2 lines.
  - Single-line fields get an ellipsis, with the full text in `title`.
  - Compact currency (€12.45M), with the full value in `title`.
  - Role chips show 4 plus "+N".
  - Avatars fall back to an initial taken from the email, or "?".
  - No horizontal overflow at a 1024px viewport.

### 11. Global rules and checklist
- **What to animate:** only `transform`, `opacity`, `filter`, `clip-path`, plus colour for hover and state. Never use `transition: all`.
- **Allowed layout animations:** accordion and list-item height (grid rows), and sidebar width.
- **Never:** `ease-in` on UI, starting from `scale(0)` (minimum 0.9), or UI motion over 300ms, except drawers, toasts, charts and FLIP.
- **Exits are faster than entrances.** Slow while the user is deciding (hold), fast when the system responds (release).
- **Interruptions:** anything that can be triggered rapidly uses transitions or WAAPI, never restart-from-zero keyframes.
- **Reduced motion:** `prefers-reduced-motion: reduce` removes movement (translate, scale, shake, FLIP, stagger) and keeps opacity and colour.

### 12. Text fields
- **Focus:** border `--input-border-focus` and ring `--input-ring`, both instant, with a transparent 2px outline kept for forced-colors mode. The border width never changes, so nothing shifts. Inputs never move on hover.
- **Search:**
  - Results wait `--delay-search` after you stop typing. Typing never animates.
  - While loading, the search icon becomes a 13px inline spinner.
  - The clear (×) button fades in (120ms) only when there's text.
  - The results box keeps a fixed height. Matches are highlighted with `#FBEFC9`.
- **Async validation:**
  - Runs `--delay-validate` after you stop typing.
  - Uses a reserved status line (min-height 18px) showing a spinner and "Checking …".
  - Then a ✓ or ✕ grows in (scale 0.6 with blur 2px, `--dur-tick`) with a specific message.
  - Never validates on every keystroke.
- **Textareas:** auto-grow instantly to their content (height from `scrollHeight`), up to 160px, then scroll. No scrollbar before the maximum.
- **Character counter:** hidden until 75% of the limit, then fades in (150ms); `tabular-nums`; red and semibold at the limit; reserved line.
- **Password:** show/hide icon crossfades (scale 0.6 with blur, 150ms); strength bar fills with `scaleX` (240ms `--ease-out`) while its colour shifts (200ms); hint in a reserved line.
- **Prefix and suffix:** the affix sits in its own segment; values right-aligned in `tabular-nums`.
- **Email chips:** Enter, comma, Tab or paste split text into chips that pop in from scale 0.9, 40ms apart. Invalid chips turn red, shake once and become editable on click; the error count sits in a reserved line. Backspace on an empty input selects the last chip first; a second Backspace deletes it. Removing a chip FLIPs its neighbours (200ms).
- **@mention and slash menus:** future feature (Allan, 2026-10-08). When built: open under the caret with no animation; arrows move the highlight instantly; Enter or Tab inserts; Esc closes.
- **Autosave:** saves `--delay-autosave` after you pause; "Saving…" → "Saved" → "Saved just now" (2s), each step crossfading over 150ms. Never flashes, never toasts.
- **Mobile (the app and the public pages):** inputs at least 16px on phones so iOS doesn't zoom; primary actions stay visible above the keyboard.

### 13. Dialog behaviour
- **Height changes:** when content changes, the dialog resizes from its old to its new height over `--dur-resize` with `--ease-in-out`. The content swaps instantly.
- **Submit:** the button keeps its width and swaps its label for a spinner; fields and Cancel are disabled while sending; double submits are blocked; the dialog closes only after the save succeeds, then shows a toast; errors appear inside the dialog. With an optimistic update it closes immediately (§5).
- **Focus:** first field (or primary action) on open; Tab trapped; Esc closes and focus returns to the trigger; page scroll-locked with scrollbar compensation. Radix Dialog does this: verify, don't reimplement.
- **Stacked sheets:** the lower sheet steps back (`translateX(-28px) scale(.97)`) under a 12% dim; the top sheet slides in with `--ease-drawer`; never more than two.
- **Unsaved changes:** a dirty dialog or sheet intercepts close (×, Cancel, overlay, Esc). The footer turns into "Discard unsaved changes?" with **Keep editing** and **Discard** (danger), fading up 4px over `--dur-guard`; focus moves to Keep editing. Never a second modal, never a browser confirm.

### 14. More controls
- **Checkbox:** the tick draws in (`stroke-dashoffset`, `--dur-tick`, `--ease-out`); box colour 120ms; `scale(.9)` while pressed; parents show **indeterminate** (a dash) when only some children are selected.
- **Radio:** the dot grows from scale 0.4 plus opacity (`--dur-tick`).
- **Segmented controls:** one layer slides between options, like tabs (Gio Sales' `MovingTabLayer`). Never crossfade options separately.
- **File upload:** drop zone highlights on drag-over (border and background 120ms, scale 1.01); file rows open space with grid rows (240ms); progress fills with `scaleX` (linear) and ends with a check that grows in; long names truncate with the full name on hover.
- **Pagination and infinite scroll:** don't add new ones. The existing "Load 25 more" buttons stay until their list is virtualised (§9).
- **Right-click menus:** open at the cursor, clamped inside the viewport, with **no animation** (Allan, 2026-10-08; overrides the menu rules for ContextMenu). The target row stays highlighted while the menu is open.
- **Truncated text:** a tooltip only when the text is actually cut, with tooltip timing (400ms delay, instant for neighbours). Never on fully visible text.
- **Slider:** the stock Radix slider; thumb press scale and token timings only.

### 15. Delight (use sparingly)
- **When:** only **Opening filled** (Mark hired). Once per opening per session. Never for bulk actions, imports or automations.
- **What:** the confirm label morphs to "Hired" (blur crossfade, 180ms); a 10-dot burst from the button (34–50px radius, 560ms `--ease-out`, fading out); the candidate's row or card gets a soft green background tint that fades out (900ms). A tint, not a glow. Later state changes just update.
- **Reduced motion:** no burst and no tint; only the state change.
- **Never:** full-screen confetti, sounds, or anything over 1s.

### 16. Loading vs empty (Allan, 2026-10-09)
- **Choose the view from request status:** loading shows the skeleton (first load only), success with 0 rows shows the empty state, success with 0 rows and active filters shows filtered empty, and an error shows inline Retry. Never use the row count alone, and never let a fetch error read as an empty list.
- **Skeletons** match the real layout's footprint and time out into the error state after 15s. Refreshes keep the content and show a small inline spinner, never the skeleton.
- **Swap** skeleton and content with a 200ms crossfade in a shared grid cell (`Loadable`). No layout shift.
- **Illustrations:** only the canonical ones (`CandidatesEmpty` for candidate lists). Each plays once per mount (once per surface per session with `onceKey`), with no more than one animated illustration in view at a time. Inside a list that has rows elsewhere (an empty stage column), show nothing. The plane scene (2.8s, sparkle and dot from scale .2) is an approved illustration and exempt from §11's 300ms and scale-0.9 limits; UI motion is not.
- **Filtered empty** never shows "add" actions.

If a change does go through Lovable, paste this at the end of the prompt:
```
Motion check: tokens only · no transition:all · no ease-in · no scale(0) · exit faster than enter · popovers from trigger · keyboard/typing/route not animated · reduced-motion handled · hover gated to mouse · tabular-nums on numbers · reserved space for messages/bars/banners (no layout shift) · long text truncates with title · DE strings fit · optimistic + rollback where applicable · Undo over confirm for reversible actions · focus instant, same border width · typing never animates · inputs ≥16px on mobile · async checks debounced in reserved space · dialogs resize smoothly, trap & return focus, lock scroll · submit keeps width, blocks double submit · dirty dialogs guard inline (no second modal) · indeterminate parents · right-click menus not animated · tooltips only on truncated text · delight once per entity, never on bulk.
```
