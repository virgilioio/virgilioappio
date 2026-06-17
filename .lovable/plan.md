## Problem

When a logged-in user opens a public booking link, the Gio splash never goes away.

Root cause is in the splash dismissal logic in `src/App.tsx`:

- `AppBootstrap` only reports the splash ready when `ready && !session` — i.e. on the signed-out path.
- For signed-in users, the splash is only dismissed inside `RequireAuth`, which never mounts for public routes.
- Sibling public pages already work because each one calls `useReportSplashReady(...)` itself:
  - `PublicJobPosting.tsx` → `useReportSplashReady(!loading)`
  - `PublicCareersPage.tsx` → `useReportSplashReady(!isLoading)`
  - `VirgilioCareersPage.tsx` → `useReportSplashReady(!isLoading)`
- `src/pages/PublicBookingPage.tsx` is missing this call entirely, so the splash stays up forever for any visitor with an existing Supabase session.

The booking page itself is fine — the SECURITY DEFINER RPC `get_public_booking_profile` and anon SELECT on `booking_configurations` both work — it's just hidden behind the splash overlay.

## Change

`src/pages/PublicBookingPage.tsx`:

1. Import `useReportSplashReady` from `@/contexts/SplashReadyContext`.
2. Call it once near the top of the component, gated on the page having finished its initial config + token resolution:
   ```ts
   useReportSplashReady(!isLoading && !isResolvingToken);
   ```
   This mirrors the pattern used by the other public pages and dismisses the splash as soon as the booking config query settles (whether success or error), so the underlying page — expired view, booking view, or error — is visible.

No backend, RLS, or query changes needed.

## Verification

- Open a booking link while signed in → splash should fade out and the booking UI (or expired/error view) should render.
- Open the same link in a private window (signed out) → unchanged; `AppBootstrap` still dismisses the splash via the `!session` branch.