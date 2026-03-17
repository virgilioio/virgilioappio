

# Fix Avatar Swap Timing During Flip

## Problem

The avatar image source swaps via a `setTimeout(175ms)` that tries to coincide with the CSS animation's 90° midpoint — but JavaScript timers aren't frame-accurate, so the old face is briefly visible after the edge, or the new face pops in before reaching edge-on.

## Solution: Classic Card-Flip with Two Layers

Instead of swapping a single `<img>` src mid-animation, use two stacked `<img>` elements (front + back) with `backface-visibility: hidden`. Rotating the container 180° automatically hides the front at 90° and reveals the back — no JavaScript timing needed for the visual swap.

**How it works:**
- Two `<img>` tags stacked via `position: absolute`, both with `backface-visibility: hidden`
- The "back" image is pre-rotated 180° so it faces away initially
- On flip: rotate the container 180° → front disappears at 90°, back appears seamlessly
- After animation ends: update indices so current "back" becomes "front", queue next avatar as new "back"
- Result: perfectly synchronized swap every time, zero flicker

## Files to Edit

**`src/components/ui/GioLoader.tsx`**
- Replace single `<img>` with a container holding two absolutely-positioned `<img>` elements (front/back)
- Both get `backfaceVisibility: 'hidden'`; back image starts at `rotateY(180deg)`
- Animate the wrapper's `rotateY` from `0 → 180` (or `180 → 360`) via the existing CSS keyframes
- On animation end (`onAnimationEnd`), swap indices: back becomes front, increment next avatar — no `setTimeout` needed
- Remove `isMirrored` / `isFlipping` state in favor of a simple rotation-degree state and `animating` boolean

**`tailwind.config.ts`** — no changes needed; existing `coin-flip-2d` keyframes still apply to the wrapper

