# Gio ATS · Motion & Feel adoption (Block B §1–§15)

Built directly in this repository by Claude on 2026-10-09 and merged to `main` phase by phase. It follows Allan's decisions recorded in `CLAUDE.md`:
- build in the repo;
- one toast system (Sonner, bottom-left);
- records keep confirmation dialogs;
- bugs fixed first.

**How it was tested.** Each phase was checked in headless Chromium against the local dev server. Every Supabase request was intercepted and answered with fake rows, so nothing was read from or written to the real project. After each phase, a pixel comparison against the previous `main` at 1440px and 390px confirmed that screens at rest didn't change, apart from the intended differences listed under each phase. The rules and the shared primitives are in `CLAUDE.md` (Implementation map).

## Phases

| Phase | What changed | Checked |
|---|---|---|
| 0 · Audit | `motion-audit.md` (branch `motion/ats-audit`) | — |
| Bugs | Candidate paging order, chat history order, sort defaults, sticky headers, analytics/JobDetail chunking, pipeline stage-automation filter, duplicate `boxShadow` keys | Each bug reproduced, then confirmed fixed |
| 1 · Tokens | Block B tokens on `:root`, Tailwind mappings, a reduced-motion base layer | Computed styles |
| 2 · Primitives | Press, menus/popovers (grow from the trigger), tooltips (400/400), dialogs, drawers, Sonner-only toasts, tabs (one moving layer), switch, accordion, focus ring, hover gated to the mouse | Per primitive: timing, origin, keyboard paths with no animation, reduced motion |
| 3 · Tables | Sort rows FLIP (≤60 rows), the sort arrow rotates, sticky-header shadow, instant row hover, tabular numbers | Sort and scroll traces |
| 4 · Boards | Lift, dashed slot, spring drop, FLIP, Esc cancel, touch long-press. Job board and /pipeline. | Drag, drop, Esc, PATCH sent, reduced motion |
| 5 · Dashboards | Shimmer skeletons, Loadable crossfade, KPI count-up then blend, bars grow then morph (div bars and recharts), previous numbers kept through a refetch, 600ms spinners | Skeleton sizes, count-up samples, morph on a job filter and a country filter, reduced motion |
| 6 · Forms | Reserved validation line, shake on invalid submit, fixed-height combobox list, month slide, wizard step slide, chip FLIP, buttons keep their width while loading, copy icon swap | Each control, in the browser |
| 7 · Navigation | No route fades, selection bar enter/exit, notifications open space then fade, bell pulses once, progress fills use scaleX, IconTips | Fake clock for notifications; selection bar enter and exit |
| 8 · States | 18 `confirm()` boxes → `confirmDialog`, 9 missing delete confirmations added, failed board moves revert with Retry, offline banner, avatar fade, dashboard greeting loading state | Forced 500 then Retry; offline/online; dialog focus |
| 9 · Scale and touch | Pipeline fetch past 1,000 rows (bug), `useIsMobile` first render (bug), Candidates table windowing, scroll memory (Candidates, job tabs), content-visibility on long columns, first-load stagger, side sheets swipe to dismiss | 1,200-card board; 600 candidates; CDP touch swipes |
| 10 · Previews and language | HoverCard timing, tooltip on truncated text, overflowing tab bars scroll with a fade | Scratch pages; pseudo-German tab labels at 1024, 700 and 390px |
| 11 · Worst-case data | Nav labels from 1280px (header overlap at 1024–1279), 3-line job title, 1-line table title, 2-line company names, "Unnamed candidate", initials fallback, compact money in the job's own currency, phone fixes on /pipeline and /analytics | Overflow scan of 10 routes at 1024 and 390px |
| Batch 2 | 16px inputs on phones, password and copy icon swaps, chip Backspace and paste, autosave crossfade, dialog height transition, stacked sheets, unsaved-changes guard on the candidate form, checkbox tick and indeterminate state, radio dot, drop-zone highlight, Opening filled delight | Each control, in the browser |

## Intended visible differences

These are the screens that no longer match the old `main` pixel for pixel.

- **Toasts** are the ink Sonner card, bottom-left.
- **Candidates table:** avatars show initials instead of a dash. Select-all shows a dash when only some rows are selected.
- **Top bar from 1024 to 1279px:** the nav is icons only. It used to sit under the search box.
- **Phones:**
  - Inputs use 16px text.
  - /pipeline rows hide the funnel bar and the avatar stack.
  - /analytics widgets stack full width.
  - The job tab bar fades at its right edge.
- **Job compensation:** compact money in the job's own currency symbol (it used to show "$12450k" whatever the currency).

## Behaviour contracts kept

- **Draft auto-save** keeps its 1s cadence. Only the status label now fades between states.
- **The job pipeline still opens on the board on phones.** The code asked for the list view there, but phones never got it because of the `useIsMobile` bug, and the list view doesn't fit a 390px screen yet.
- **Mark hired, Req IDs and the Gio Sales sync** are unchanged. The only change is the delight on success.

## Open items, closed (2026-10-09, second pass)

Same method: fake data only, each change checked in the browser, pixel comparison against the previous `main` at 1440px and 390px. An independent review of the branch found eight issues; all were fixed before merging.

| Item | What changed | Checked |
|---|---|---|
| Dead code | `IndependentCandidateTable`, `CandidateTable`, `SettingsMobileHeader`, `MobileStatusTabSelector` and the `vaul` drawer wrapper removed. The `vaul` package is still listed in `package.json`, but no code uses it any more. | Type check, build |
| Breakpoints | `useIsMobile()` now uses the shell's 640px line (`SHELL_BREAKPOINT`); the public booking page passes 768 to match its `md:` layout; CandidateChat uses the shared hook. 640–767px windows no longer mix the desktop shell with the phone job header. | Job, settings and dashboard pages at 600 and 700px |
| /pipeline counts | Same-size skeletons for the active count and funnel until a job's metrics arrive, then a crossfade; a failed load shows "—"; rows that are new after a filter change also load rather than show 0. | 1.5s delayed and failing metrics; row height constant |
| Analytics line chart | The hand-built SVG line morphs to new values over 320ms (`--ease-in-out`), resampling when the point count changes. | 30 → 90-day switch; reduced motion |
| Phone pipeline list | Phone layout (tick, name, role, then match · days · status, always-visible move button), toolbar shown on phones, 28px side padding dropped there, list is the phone default when no choice is saved. "Add filter" no longer shows two plus signs. | 390px: select, mixed stage tick, move menu, row tap; 1440px unchanged |
| Text fields | `Textarea` auto-grows to 160px (respects a manual resize; dialogs don't animate while typing). `CharCounterLine` on SEO title/description, meeting location and booking notes. `AffixInput` for salary and `/jobs/` slug fields. `useAsyncValidation` + `AsyncStatus`, first on team invites ("already in this workspace / pending invitation"; informative, sending still runs the server check). Top-bar search: 150ms debounce, stale answers ignored, inline 13px spinner, fading clear button, fixed results height. | Scratch page and real screens; no layout shift |
| Segmented controls | `useSegmentLayer` + `SegmentLayer`: one sliding fill for 22 hand-rolled controls (list in the commit). Same look at rest; keyboard changes jump. | Clip-path traces; pixel diffs only on rounded-corner antialiasing |
| Hover previews | `JobPreview` / `CandidatePreview` on the job link in a candidate's breadcrumb, the linked job on a sourcing project and candidate names in the job briefing. Portalled; mouse only. | 500ms open, focus doesn't open |

### Intended visible differences in this pass
- **Phones:** the job pipeline opens on the list, with the filter/search/toggle toolbar; the board and list use the full width (the 28px side padding is gone on phones).
- **Salary inputs:** the currency and period sit in their own segments; the amount is right-aligned.
- **Search:** the results panel is always 560px tall; a clear button appears in the input when there's text.
- **Invite sheet:** a status line under the addresses.
- **SEO fields:** the counter appears from 75% of the limit instead of always.

### Still open
- **Search highlight colour.** Matches were already highlighted, in the ATS's own `#FFF4B8`. Block B names `#FBEFC9`; it was kept as is, under the visual-identity rule.
- **Not converted:** three segmented controls draw a border or inset outline only when active: job status in the wizard, the dossier view switch and the job form section nav. They still switch instantly.
- **Dark mode** is unfinished and not wired up: there's no theme provider, and the toggle is unused. The redesigned screens hard-code about 6,000 colours. Left as it is, per CLAUDE.md.
