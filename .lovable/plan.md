# Find — composer redesign + saved-search chip flow

Three focused refinements on the empty-state canvas, all visual/presentation.

## 1. New composer shape (replaces the round chat input)

Currently `AIJobAssistant` renders a rounded-[28px] pill with the textarea + a Chat-with-Gio switch + send arrow. On the Find page we render it inside `FindEmptyState`, so it inherits that shape. The screenshot calls for a card-style composer that matches the rest of the page chrome.

Approach: introduce a `variant="find"` prop on `AIJobAssistant` (default behaviour unchanged for Dashboard). When `variant="find"` it renders this layout instead of the pill:

```text
┌──────────────────────────────────────────────────────────────┐
│  Senior product designer with design-systems experience…    │  ← textarea, 3 rows min,
│                                                              │     auto-grow, no border
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  📎 Attach JD   🔗 Paste LinkedIn URL   💼 Use an open job  │
│                                          ⌘+Enter  [ ✨ Find  │
│                                                  candidates→]│
└──────────────────────────────────────────────────────────────┘
```

- Outer container: white, `rounded-2xl`, `border border-border`, `shadow-[0_1px_2px_rgba(0,0,0,0.04)]`, focus-within ring `ring-1 ring-virgilio-purple/30 border-virgilio-purple/40`.
- Top: textarea, `px-4 pt-3.5`, transparent, `placeholder:text-text-tertiary`, Inter 14px, `min-h-[84px]`.
- Hairline divider, then footer row `px-3 py-2.5` with:
  - Left cluster: three ghost chips (`Attach JD` / `Paste LinkedIn URL` / `Use an open job`) — 30h, `rounded-lg`, `hover:bg-[#F1F0EC]`, `text-[12.5px]` Poppins medium, leading icons `h-3.5 w-3.5`. No-op for now (handlers wired later).
  - Right cluster: kbd hint `⌘ + Enter` (small stacked text, `text-[10.5px] text-text-tertiary`) + primary `<Button variant="purple" size="md" icon={Sparkles} iconRight={ArrowRight}>Find candidates</Button>`.
- Chat-with-Gio toggle moves to a small ghost link below the composer, right-aligned: `Chat with Gio instead →` (keeps existing toggle handler).
- Word-count and the existing send-arrow button are removed in this variant (the primary button replaces them).

## 2. Re-imagine the AI validation feedback

Drop the row of green/grey pill badges (`Role`, `Responsibilities`, `Industry`, `Location`, `Outcomes`). Replace with one calm inline strength line directly under the composer card, right-aligned next to the `Chat with Gio` link:

```text
●●●○○  Gio has enough on role + location · add outcomes for better matches
```

- 5 small 6px dots, filled in `virgilio-purple` as items get checked, empty dots `bg-text-tertiary/25`.
- Caption text `text-[11.5px] text-text-secondary`, dynamic, generated from `currentValidation`:
  - 0 checked → `Add a role, location, and what success looks like.`
  - 1–2 → `Looking good — add {missing[0]} and {missing[1]} for stronger matches.`
  - 3–4 → `Strong prompt. Add {missing[0]} to tighten results.`
  - 5 → `Ready to search.` (dots all purple, caption in `text-emerald-600`).
- No green chips, no checkmarks, no badge grid. The whole feedback area is one quiet line ~18px tall.

Logic stays in `validateJobPrompt`; only the rendering changes, gated behind `variant="find"`.

## 3. Continue-a-saved-search chips — true horizontal wrap

The chips already use `flex flex-wrap`, but each chip is wide enough (bookmark + name + count + link icon + dot + relative time) that two of them fill a row and most projects bump to a new line, reading as a vertical list. Fix by tightening the chip:

- Drop the dot separator and `formatDistanceToNow(...) ago` text inside the chip — move the timestamp to a `title` tooltip only.
- Keep: bookmark icon, name (truncate at `max-w-[160px]`), count `Badge tone="neutral" size="xs"` only when > 0, small `LinkIcon` only when `job_id` is set.
- Reduce chip height to 30 (`h-[30px]`), `px-2.5`, `gap-1.5`, name text `text-[12px]`.
- Container stays `flex flex-wrap gap-1.5`.

Result: 4–6 chips per row at the current canvas width, wrapping to the next line only when they run out of horizontal space — matching the screenshot.

## Files touched

- `src/components/dashboard/AIJobAssistant.tsx` — add `variant?: 'default' | 'find'` prop; render the new card composer + inline strength meter when `variant="find"`; leave default branch untouched.
- `src/components/sourcing/FindEmptyState.tsx` — pass `variant="find"` to `AIJobAssistant`; tighten the saved-search chip markup; minor spacing cleanup around the composer (info banner sits below as today).

## Out of scope

- Wiring `Attach JD` / `Paste LinkedIn URL` / `Use an open job` handlers (visual only for now).
- Changes to results view, sidebar, top header, or `SavedSearchSelector` popover.
- Validation rule changes inside `jobPromptValidation.ts`.
