# Navigation Header — Gio Foundation v1.0

Bring the top header in line with the uploaded spec. Same DNA as today (black pill bar, left section cluster, right utility cluster, white-pill active state), but every measurement, state, and band is locked to the spec.

## Anatomy (locked tokens)

- Bar: height **44px**, radius **16px**, bg `#0d0d09`, hairline `rgba(255,255,255,0.06)` ring, padding-x **12px**, gap between clusters **24px**.
- Section nav item: height **28px**, padding-x **10px**, radius **8px**, gap-icon-label **8px**, icon **14px**, label **13px Poppins 500 tracking -0.01em**.
- Right cluster gap **8px** between controls.

## Section nav (left)

States, all per spec:

| State | Treatment |
|---|---|
| Default | text `rgba(255,255,255,0.72)`, icon same |
| Hover | bg `rgba(255,255,255,0.08)`, text `#fff` |
| Active | bg `#fffcf9` (Opaline White), text `#0d0d09`, icon `#0d0d09`, weight 600 |
| Active + notification | active pill + 6px lilac `#D7C5FB` dot top-right of icon |
| With dropdown | trailing chevron 12px at 65% opacity; opens popover (e.g. Jobs → recent jobs, Candidates → saved views) |
| Focus-visible | 2px `virgilio-purple/40` ring, no offset |

Driven by a new `navigationItems` schema field: `{ notification?: boolean; dropdown?: () => ReactNode }`.

## Right cluster

Order: **Search · Create · Credits · Bell · (Workspace) · Avatar**.

- Search: 30h, 280w default, **focused → 380w** (already partially in place), placeholder "Search candidates, jobs, companies…", kbd `⌘ /` chip right. Adopt focus ring `virgilio-purple/40`.
- Create: dark-on-dark **`<Button variant="primary" size="sm" onDark dropdown>`**, label "Create", `⌘ N` opens menu (new shortcut). Uses existing `GlobalCreateButton`.
- Credits chip: `SourcingCreditIndicator` restyled to 24h capsule, `rgba(255,255,255,0.08)` bg, lilac dot when low.
- Bell: 28×28 icon button, notification dot uses `CounterBadge` overlay.
- Avatar: 28×28, hover ring `rgba(255,255,255,0.15)`.

All right-cluster controls inherit `onDark` color remap via a wrapper class.

## Context bands (under the header)

New stackable region directly beneath the header, owned by `Layout.tsx`. Three band types, all 36h, radius 12, full-width inside the same horizontal inset as the header:

1. **Filter band** — lilac `#F3EEFF`, hosts active `RemovableChip`s + "Clear all". Rendered when `useFilterContext()` reports active filters on the current route.
2. **Trial / billing band** — amber `#FFF6D6` border-l-4 `#E0A23A`, copy + right-aligned "Upgrade" `Button variant="purple" size="xs"`. Driven by `useBillingStatus()`.
3. **Impersonation band** — citron-noir `#0d0d09` text on lilac, "Viewing as {name} · Exit" link. Driven by `AdminModeIndicator` state (re-homed from inside the bar to this band).

A shared `<HeaderContextBands />` component composes them in priority order (impersonation → billing → filter).

## Behavior

- **Scroll**: at `scrollY > 2`, add `shadow-[0_6px_24px_-12px_rgba(0,0,0,0.45)]`. Already partial — just tune the shadow token.
- **Keyboard**:
  - `⌘ /` focus search (already wired)
  - `⌘ K` open command palette (alias)
  - `⌘ N` open Create menu (new — listen globally, forward to `GlobalCreateButton` trigger ref)
- **Section switching** preserves scroll position via existing router.

## Responsive cascade

| Range | Behavior |
|---|---|
| ≥ 1280 | Full bar as specced |
| 1024 – 1279 | Search collapses to 32×32 icon button that expands inline on click; nav labels remain |
| 768 – 1023 | Nav labels hide, icons only with tooltip; search stays as icon |
| < 768 | Header hidden; existing `MobileBottomNav` + hamburger sheet take over (no change) |

Implemented with Tailwind `lg:` / `md:` breakpoints and a `useMediaQuery` toggle for the inline-expanding search.

## Technical breakdown

Files touched:

- `src/components/layout/Header.tsx` — full rewrite of layout/states, schema extension for `notification` + `dropdown`, kbd shortcuts effect.
- `src/components/layout/HeaderContextBands.tsx` — **new**, composes the 3 bands.
- `src/components/layout/Layout.tsx` — mount `<HeaderContextBands />` between `<Header />` and `<main>`; adjust `main` top padding from 64 → 64 + dynamic band height (use `useResizeObserver` or a CSS var set by the bands component).
- `src/components/layout/SourcingCreditIndicator.tsx` — capsule restyle (24h, transparent-on-dark variant).
- `src/components/layout/GlobalCreateButton.tsx` — expose imperative `open()` for ⌘N, switch to `Button variant="primary" onDark dropdown`.
- `src/components/admin/AdminModeIndicator.tsx` — strip in-bar styling, expose as a band-ready row.
- `src/components/search/GlobalSearchBar.tsx` — focus-ring token swap, condensed-mode icon trigger for 1024–1279.
- `tailwind.config.ts` / `index.css` — add `--header-band-h` CSS var, `shadow-header-scroll` token, `bg-opaline` if not present.

No backend/RLS/edge function changes. Pure presentation + a tiny global shortcut listener.

## Out of scope

- New routes or new notification source (notification dots wire to existing `useNotificationCenter()` counts only).
- Redesigning the Create menu contents.
- Redesigning the user dropdown contents (only the trigger avatar styling).
- Mobile bottom nav (untouched).
