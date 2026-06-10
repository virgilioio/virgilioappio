## Goal

Make `GioSplash` the only loading screen in the app. Delete `VirgilioLoader` and `GioLoader`, and have `GioSplash` cover both the cold-load boot **and** the auth → workspace handoff as one continuous gesture.

## Decisions

- **GioSplash** = the single full-screen loader. Plays once per tab session, stays up until: (a) the app has booted AND (b) auth + org context have resolved AND (c) the 800ms minimum has elapsed. Then plays its exit.
- **GioLoader** (flipping mascot) is also retired. The few in-content "AI thinking" uses (`GioThinkingHeader`, `SuggestedCandidatesLoader`) get replaced by a tiny inline animated dot using the brand `#0d0d09` — same vibe as the splash, no separate loader component. No mascot, no spinner.
- **VirgilioLoader** is fully deleted.
- In-route auth pages (`Login`, `SignUp`, `MailOAuthCallback`, `ChromeOAuthStart`, `TrialActivation`, `SharedList`) currently render `<GioLoader message="Loading…" />` while they wait for a session check. These get the same inline brand dot (small, centered) — they're inside the page, not a full-screen reboot, so the splash is wrong there.

## Behavior of GioSplash after this change

- Renders from `main.tsx` on cold load only (session flag, unchanged).
- The `show` prop becomes a derived `appReady` boolean lifted from inside the app:
  - `appReady = authBootstrap.ready && (no session OR orgContext resolved OR platform admin OR no-org-needed route)`.
- Because `AppBootstrap` lives inside `<App />`, expose readiness via a tiny context (`SplashReadyContext`) that `AppBootstrap` + `RequireAuth` write to and `main.tsx` reads.
- 800ms minimum is enforced inside `GioSplash` (already implemented).
- Exit unchanged: sheet up, logo down, unmount.

## Loaders removed

| File | Action |
| --- | --- |
| `src/components/ui/VirgilioLoader.tsx` | delete |
| `src/components/ui/GioLoader.tsx` | delete |
| `src/assets/gio-avatar.png`, `gio-face-*.png` | keep (used elsewhere as mascot in empty states) |

## Call sites rewired

**Full-screen boot loaders → removed (covered by GioSplash):**
- `src/App.tsx` x4 (Suspense fallback, `AppBootstrap`, `RequireAuth` session, `RequireAuth` org). Suspense fallback becomes `null`; the boot/auth/org loaders just stop rendering and let GioSplash sit on top until ready.
- `src/components/auth/AuthGate.tsx` — return `null` while loading.
- `src/components/auth/BillingGuard.tsx` — the 400px-min billing check becomes a small inline brand-dot placeholder (it's a sub-page check, not a boot).

**In-page loaders → inline `<BrandDot />`** (new tiny primitive, ~28px, single pulsing `#0d0d09` dot using `--gio-ease-glide`):
- `src/pages/Login.tsx`
- `src/pages/SignUp.tsx`
- `src/pages/MailOAuthCallback.tsx`
- `src/pages/ChromeOAuthStart.tsx`
- `src/pages/TrialActivation.tsx`
- `src/pages/SharedList.tsx`
- `src/components/sourcing/GioThinkingHeader.tsx`
- `src/components/sourcing/SuggestedCandidatesLoader.tsx`
- `src/components/auth/BillingGuard.tsx` (billing check spinner)

## New primitive

`src/components/ui/BrandDot.tsx`
- Inline component, `sm` (16px) / `md` (24px) / `lg` (32px).
- Single `#0d0d09` circle, gentle opacity pulse (1 → 0.35 → 1, 1.4s ease-in-out infinite).
- Optional `message` prop renders a 13px Inter muted label below — keeps the existing copy ("Connecting to GoGio…", "Checking billing status…", etc.).
- No spinner, no mascot. Same brand mark identity as the splash.

## Splash readiness wiring (technical)

```text
main.tsx
 └─ <SplashReadyProvider>
     ├─ <App />               ← writes ready=true once boot+auth+org settle
     └─ <GioSplash show={ready} />  ← reads ready
```

- `SplashReadyContext` exposes `setReady(true)`.
- `AppBootstrap` calls `setReady(true)` once `useAuthBootstrap().ready` is true AND either no session, or org context resolved/not required.
- `RequireAuth` also calls `setReady(true)` on its successful render path (covers cached-auth fast path).
- Initial value is `false`; GioSplash stays mounted; its internal 800ms minimum prevents flash on instant boots.

## Files

**Delete**
- `src/components/ui/VirgilioLoader.tsx`
- `src/components/ui/GioLoader.tsx`
- `src/assets/virgilio-logomark.svg.asset.json` (was only consumed by VirgilioLoader)

**New**
- `src/components/ui/BrandDot.tsx`
- `src/contexts/SplashReadyContext.tsx`

**Edit**
- `src/main.tsx` — wrap with `SplashReadyProvider`, drive `GioSplash` from context.
- `src/App.tsx` — remove VirgilioLoader imports/fallbacks; wire `setReady` in `AppBootstrap` and `RequireAuth`; Suspense fallback → `null`.
- `src/components/auth/AuthGate.tsx` — return `null` while loading.
- `src/components/auth/BillingGuard.tsx` — swap to `<BrandDot message="Checking billing status…" />`.
- `src/pages/Login.tsx`, `SignUp.tsx`, `MailOAuthCallback.tsx`, `ChromeOAuthStart.tsx`, `TrialActivation.tsx`, `SharedList.tsx` — swap GioLoader → BrandDot.
- `src/components/sourcing/GioThinkingHeader.tsx`, `SuggestedCandidatesLoader.tsx` — swap GioLoader → BrandDot.

## Non-goals

- Not touching the Gio mascot used in empty states / standard empty cards — that's a different system.
- Not changing the splash motion, geometry, timings, or session-once rule.
- No new dependencies.

## Verification

- Hard refresh `/dashboard` while signed in → splash plays once, exits when org context is ready (or at 800ms minimum, whichever is later), app underneath revealed with no fade.
- Hard refresh `/auth` while signed out → splash plays once, exits at 800ms, login page revealed.
- Soft navigation between pages → no splash.
- Slow auth resolve (throttle) → splash holds until ready, no flicker.
- `prefers-reduced-motion: reduce` → splash skips morph, exits with 200ms opacity fade.
