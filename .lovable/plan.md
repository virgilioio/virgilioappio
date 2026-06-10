## Goal

Replace the flipping Gio avatar shown on screen-change / route loading screens with the new Virgilio logomark, animated as a simple, gentle fade in ↔ fade out.

## Scope

Only the **full-screen "changing screens" loader** (Auth/route/workspace loads). Leave the playful Gio flipping avatar in place for thinking/sourcing/AI states (`GioThinkingHeader`, `SuggestedCandidatesLoader`, `RoleInterpretationDrawer`, `AIJobAssistant`, scorecard generation, etc.) — those are intentionally character-driven.

## Steps

1. **Upload the new logomark as a CDN asset**
   - `lovable-assets create --file /mnt/user-uploads/Virgilio_Logomark_2025_1.svg --filename virgilio-logomark.svg > src/assets/virgilio-logomark.svg.asset.json`

2. **Create `src/components/ui/VirgilioLoader.tsx`**
   - Renders the logomark centered, with a softly pulsing fade (opacity 1 → 0.35 → 1, ~1.6s, ease-in-out, infinite).
   - Uses the existing `animate-pulse`-style approach but with a custom Tailwind utility `animate-logo-fade` for the exact opacity curve. Keyframe added to `tailwind.config.ts`.
   - Sizes: `sm` (32px) / `md` (56px) / `lg` (80px). Optional `message` prop renders the same small muted label below as `GioLoader`.
   - No flipping, no spinner, no progress bar — strictly fade in/out.

3. **Swap usage in screen-change loaders only**
   - `src/App.tsx` (4 call sites: route Suspense, auth init, authenticating, workspace load)
   - `src/components/auth/AuthGate.tsx`
   - `src/components/auth/BillingGuard.tsx`
   - Keep `GioLoader` exported and untouched for all other current consumers.

4. **Tailwind keyframe**
   - Add `logo-fade` keyframes + `animate-logo-fade` utility in `tailwind.config.ts`.

## Non-goals

- Not touching sourcing/AI thinking loaders.
- Not redesigning messages, layout, or backgrounds of the loader screens.
- No new dependencies.

## Files

- **New:** `src/assets/virgilio-logomark.svg.asset.json`, `src/components/ui/VirgilioLoader.tsx`
- **Edited:** `src/App.tsx`, `src/components/auth/AuthGate.tsx`, `src/components/auth/BillingGuard.tsx`, `tailwind.config.ts`
