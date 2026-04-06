

# Fix: Smooth Crossfade Transition for Photo Carousel

## Problem

The current approach uses `key={fadeKey}` to force React to remount the `<img>` element on each transition. This causes:
1. The image unmounts completely, creating a flash/blank frame before the new image loads
2. The `animate-fade-in` animation includes a `translateY(10px)` shift — not a pure fade, but a slide-up
3. On first transitions the new image hasn't been preloaded, so there's a visible pop-in

## Solution: Dual-Image Crossfade

Replace the single `<img>` with **two stacked images** — the current photo and the previous photo. The current fades in on top of the previous, creating a true crossfade with no blank frame.

```text
┌─────────────────────┐
│  [previous photo]    │  ← opacity: 1, always visible underneath
│  [current photo]     │  ← opacity transitions 0 → 1 over 700ms
└─────────────────────┘
```

### Changes in `PhotoCarouselWidget.tsx`

1. **Track `prevIndex`**: Add a `prevIndex` state that stores the last index before a transition. Update it in the auto-advance timer and in manual nav (goNext/goPrev/dot click).

2. **Render two `<img>` elements stacked absolutely**: The previous photo sits at opacity 1, the current photo transitions from opacity 0 to 1 using a CSS `transition: opacity 700ms ease-in-out` (not a keyframe animation). After the transition completes, prevIndex catches up.

3. **Preload next image**: In the auto-advance `useEffect`, preload the upcoming image via `new Image().src = nextUrl` so it's ready before the fade starts.

4. **Remove `fadeKey`** state entirely — no longer needed since we're not remounting elements.

5. **Use inline `transition` + `opacity`** instead of `animate-fade-in` to avoid the translateY shift and ensure a pure opacity crossfade.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/PhotoCarouselWidget.tsx` | Replace single-image remount with dual-image crossfade; add prevIndex tracking; preload next image; remove fadeKey |

