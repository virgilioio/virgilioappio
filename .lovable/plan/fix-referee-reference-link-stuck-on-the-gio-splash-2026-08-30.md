# Fix: referee reference link stuck on the Gio splash

## What's happening (verified)

The splash overlay is rendered once per page load in `src/main.tsx` and only disappears when something in the tree reports "splash ready". There are exactly two reporters:

- `AppBootstrap` reports ready when auth bootstrap settles **and there is no session** (`ready && !session`).
- `RequireAuth` reports ready when a session **and** org context are resolved — but `RequireAuth` never mounts on public routes.

Public pages therefore have to report readiness themselves. `PublicBookingPage` does exactly that (`useReportSplashReady(!isLoading && !isResolvingToken)`), but `PublicReferenceAnswer.tsx` and `PublicReferenceSubmit.tsx` do **not** call it at all.

Consequence: for any visitor whose browser has a Supabase session — or a stale/expired stored session whose org context never resolves — nothing ever reports readiness on `/reference/:token` or `/references/:token`, so the splash stays up forever and the form is never seen. A browser check against both the published domain and localhost with a bogus token confirmed the page itself renders correctly (it shows the expired card) when there is no session, which matches this diagnosis.

## The fix

1. In `src/pages/PublicReferenceAnswer.tsx`, call `useReportSplashReady(...)` once token resolution settles (resolved, expired, declined, or error) — the same pattern as `PublicBookingPage`.
2. Do the same in `src/pages/PublicReferenceSubmit.tsx` (candidate flow has the identical defect).
3. Belt-and-braces: also report ready from `src/components/public/PublicPageShell.tsx` on mount, so any future public page rendered inside the shell can never be trapped behind the splash.

No changes to token handling, data fetching, copy, or layout.

## Technical notes

- `useReportSplashReady` comes from `@/contexts/SplashReadyContext`; the latch is one-way (once ready, never un-ready), so reporting from both the page and the shell is safe.
- Verification: load `/reference/<bogus-token>` and `/references/<bogus-token>` in a browser with a Supabase session present in localStorage and confirm the splash clears and the terminal card renders.
