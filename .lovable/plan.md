# Dev preview route for the new onboarding

Restore a safe, dev-only way to view and click through the new onboarding flow without touching the real `/onboarding` controller (which handles pre-flight auth, invitations, and domain auto-join).

## What to build

1. **New file:** `src/pages/dev/OnboardingPreview.tsx`
   - Thin wrapper that renders `<OnboardingFlow demo />` inside the same shell.
   - Sets a `sessionStorage` flag `gio_ob_demo=1` on mount and clears it on unmount.
   - No auth guard, no pre-flight checks — pure visual/interaction preview.

2. **Edit `src/components/onboarding/flow/OnboardingFlow.tsx`**
   - Accept an optional `demo?: boolean` prop.
   - When `demo` is true:
     - Use a separate sessionStorage key (`gio_ob_demo_state`) so it doesn't collide with the real run.
     - Stub every backend call (`provision-tenant`, `set-current-organization`, `create-booking-config`, `createDepartment`, `createJob`, `get-job-matching-candidates`, `createMember`) with local Promises that resolve after a short delay and return fake data (3 mock candidates with avatars/initials, fake org id, fake job id).
     - On Step 6, instead of navigating to `/trial-activation`, reset to Step 1 and show a small "Demo complete — restart" affordance.

3. **Edit `src/App.tsx`**
   - Add lazy import and route:
     ```tsx
     const OnboardingPreview = lazy(() => import('./pages/dev/OnboardingPreview'))
     <Route path="/__preview/onboarding" element={<OnboardingPreview />} />
     ```
   - Placed outside `RequireAuth` so it's accessible without login.

## What stays untouched

- `src/pages/Onboarding.tsx` (real controller) — no changes.
- Real backend wiring, edge functions, hooks — unchanged.
- `WorkspacePreview`, `OnboardingShell`, `ProgressTracker`, `onboarding.css` — unchanged.

## Notes

- `?screen=...` query param is not used by the new flow; the preview advances by clicking through real steps. If you want a jump-to-step shortcut, say the word and I'll add `?step=1..6`.
- Route is intentionally under `/__preview/` so it's discoverable only by you and ignored by search engines / nav.
