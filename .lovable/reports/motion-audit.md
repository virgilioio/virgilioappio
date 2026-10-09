# Gio ATS · Motion & Feel audit (Task 0, no app changes)

Read-only audit of `virgilioio/virgilioappio` at `d5a264c` (2026-10-07), against Block B §1–§15 as adopted in Gio Sales.
Line numbers are from that commit.

## The app in one paragraph

Vite + React 18 + React Router 6 + Tailwind 3 + shadcn/ui, about 1,200 source files (≈5× Gio Sales). Unlike Gio Sales it is **responsive** (a real mobile layer: `MobileBottomNav`, mobile headers, `mobile-filter-drawer`) and has **public pages** for candidates, referees and clients (careers, job posting, booking, reference forms, client dossier and pipeline). Dark mode is **not live** (`next-themes` installed, no provider mounted; 126 `dark:` classes unused). No i18n: all interface text is hard-coded English; languages only affect generated content (Gio Fit output, posting language).

## 1. Motion today

| Item | Finding |
|---|---|
| Tokens | Only `--transition-fast/default/slow` (150/200/300ms) in `src/index.css:250-252`, mapped to `duration-fast/default/slow`. No easing tokens. |
| `transition-all` | **133 in 90 files**, plus 2 inline `transition: all` (`OnboardingFlow.tsx:501`, `onboarding.css:49`). |
| `ease-in` / `scale(0)` | `ease-in` 0. `scale-0` 2 (`ui/theme-toggle.tsx`, unused). |
| Durations > 300ms on UI | `duration-500` ×7 (incl. **Sheet open**, `ui/sheet.tsx:38`), `[400ms]` ×3, `700` ×1 (`JobSetupLayout.tsx:590`), `1000` ×1 (`input-otp`). |
| Hover movement | **Text inputs, textareas and tab triggers lift on hover** (`ui/input.tsx:17`, `ui/textarea.tsx:16`, `ui/placeholder-input.tsx:240`, `ui/tabs.tsx:31`). `hover:-translate-y-*` ×19, `hover:scale-*` ×14, `.hover-lift` / `.card-brand` utilities. |
| Libraries | `motion` (v12) used in one file (`ai-elements/shimmer.tsx`); `tailwindcss-animate`; `vaul` installed but unused. |
| Reduced motion | Global kill-switch in `index.css:493-505` (all animations 1ms, transitions 0s, `!important`) — it also freezes spinners and removes opacity/colour changes, which Block B keeps. The `motion/react` shimmer isn't covered. |
| Dead or broken | `src/App.css` not imported; `animate-caret-blink` undefined (OTP caret never blinks); `boxShadow` declared twice in `tailwind.config.ts` (l.22 and l.352) so `shadow-hire-dialog/menu/toast` generate nothing (used in `MarkHiredDialog.tsx`). |

## 2. Primitives (`src/components/ui`)

| Primitive | State | Gap to Block B §2 |
|---|---|---|
| Button | Heavily customised, `transition-colors` only, comment says no transform | No press scale (`gio-pressable` equivalent missing) |
| DropdownMenu, Popover, Select, Command | Shared `menuPanel` (`src/lib/menu-classes.ts`) with stock zoom-95/slide-2 | **No transform origin from the trigger** on any of them; slide offsets; solid border |
| Tooltip | Stock, no Portal | Global provider at Radix defaults (**700ms / 300ms**); 37 nested providers, 10 with their own delay (0–300ms) |
| Dialog / AlertDialog | Stock 200ms zoom-95 + slide from 48% | Slide offset, 200/200 (exit not faster) |
| Sheet | Stock, `ease-in-out`, **500ms open** / 300ms close | Drawer easing and 360/240 |
| Toast | **Two systems**: Radix `use-toast` (153 files, ~656 calls, bottom-left on desktop, top on mobile, limit 1) and Sonner (62 files, 239 calls, bottom-centre), plus a custom `CalendarToast` | One system, one position, transitions not keyframes, pause on hover/hidden |
| Tabs | Customised, `transition-all` + hover lift | No moving active layer |
| Switch | Stock | Press scale, token timings |
| Accordion / Collapsible | Stock keyframes on height | Grid-rows height + delayed fade |
| ContextMenu, HoverCard | Stock zoom | Context menu should not animate |
| Checkbox, Radio | Stock, no motion | Tick draw, dot grow, indeterminate |
| Focus | No global rule; button 30% purple ring no offset, inputs solid purple ring with offset, close buttons on `:focus` | Inconsistent; inputs need the Batch 2 border+ring |

## 3. Tables and long lists

- **Nothing is virtualised** and no screen restores scroll position.
- **Talent database is silently capped at 1,000 candidates** (`useIndependentCandidates.ts:103-111`, `.limit(1000)`, filtering in the browser). Correctness bug, not motion.
- Job pipeline board and section tables fetch every application for a job; `JobDetail.tsx:651-712` puts every candidate id in one `.in()` request (URL-length risk past a few hundred; `fetchAllRows.ts` batches 150 for this reason).
- Shared table: sticky header pins to the inner `overflow-auto` wrapper, so it **doesn't stick** where the page scrolls (Candidates, Jobs, analytics cards).
- Sorting is client-side via `useSortableTable`, which reads the sort key once: **the Sourcing sort dropdown does nothing** (`SourcingCandidateTable.tsx:178-182, 793`). Pipeline list view sorts but never wires the result.
- No column resize, no inline cell edit, no FLIP on sort.
- Chat "Load earlier messages" uses the wrong cursor (`useChatMessages.ts:51-55`: re-fetches page 2) and stacks older pages below newer ones (`MessageList.tsx:26`).

## 4. Boards and drag

| Where | Library / sensors | Gap |
|---|---|---|
| Job pipeline board (`PipelineOverview.tsx`) | dnd-kit, Mouse 10px + Touch 180/8, **no keyboard**; overlay `rotate(-1.5deg) scale(1.03)`, `0 12px 24px` shadow; drop `200ms ease` | Source card collapses to 0 height (column jumps); no dashed slot; no spring settle; Esc leaves `activeId` set; no `touch-action`; **cards have no move menu** (`CandidateCard.onMove` unused) |
| Inline kanban (`/pipeline`) | dnd-kit Mouse 4 + Touch 150/5 | Default drop, `opacity-90` overlay only |
| Reorder lists (hiring plan, interview questions, offer fields, approvers, automations, widgets, reference template sections) | dnd-kit, mixed sensors | Same overlay or none |
| Calendar reschedule (`pages/Calendar.tsx`) | Custom pointer code | **Esc doesn't cancel** a drag |

Saving moves: drag is optimistic (local state, re-fetch on failure, no red ring); menu and bulk moves wait for the server.

## 5. States and recovery

- **57 hard `.delete()` calls.** `deleted_at` columns and a `soft_delete_record` RPC exist on jobs, candidates, postings and job assignments (migration `20251110173811`), but **no client calls them**. Delete job, Discard draft, Delete candidate and team unassign are hard deletes.
- Confirmation is inconsistent: AlertDialog, browser `confirm()` (≈9 places), inline panels, or **nothing** (archive job from the detail page, team unassign, member deactivate from Settings, openings, reminders, approvers, form fields).
- Real Undo exists in 6 places, wired three different ways (raw button in a Radix toast, custom toasts, inline chip); with `TOAST_LIMIT = 1` a later toast kills the Undo.
- **9 optimistic mutations** of 132. Await-then-refetch candidates: stage moves from the profile sheet, status changes, team role changes, tags, every settings switch (job boards, feature flags, chat kill switch, booking links, WhatsApp), reminders, approver chain.
- Mark hired (`MarkHiredDialog.tsx`, `mark_hired` RPC): closes and shows a 3s custom Sonner pill. **No celebration** today (the "Opening filled" moment in §15). Unhire exists (`unmark_hired`) but has no button.
- No offline handling; avatars are stock Radix (no fade); 55 raw `<img>` without load handling.
- Empty states are well covered (`EmptyState` ×68, `InlineEmpty` ×47, illustrations ×44 files).

## 6. Language

No i18n library and no UI translations live or planned in code; §10's EN/DE/IT checks become a long-string stress pass, as in Gio Sales.

## Bugs found along the way (not motion)

1. Talent database capped at 1,000 candidates.
2. Chat "Load earlier messages" re-fetches the same page and orders pages wrongly.
3. Sourcing sort dropdown has no effect.
4. Sticky table headers don't stick on page-scrolled tables.
5. Duplicate `boxShadow` in `tailwind.config.ts` drops the Mark hired dialog/menu/toast shadows.
6. `animate-caret-blink` undefined (OTP input caret).
7. `JobDetail.tsx` loads every candidate on a job in one `.in()` request.
8. Board `stage_automations` query isn't filtered by job (`PipelineOverview.tsx:127-134`).
