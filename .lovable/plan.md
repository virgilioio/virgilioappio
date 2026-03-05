

# Cursor-Following Gradient Border on Both AI Banners

## Summary
Add a cursor-following gradient border effect to both the "AI Notes Analysis Available" banner and the "AI Suggested Rating" banner. Also unify text color to match (black/foreground on both).

## Approach
Create a reusable hook `useGradientBorder` that returns a ref and mouse handlers, then apply it to both banners as a thin gradient overlay on the existing `border-pastel-purple/50`.

## Changes

### 1. New hook: `src/hooks/useGradientBorder.ts`
A small hook that tracks mouse position relative to an element and sets a CSS custom property for a `radial-gradient` border effect. Returns `ref`, `onMouseMove`, `onMouseLeave`, and a `style` object.

The gradient will use lilac/purple tones (matching the AI identity) — e.g., a radial gradient fading from a brighter purple at the cursor to transparent, layered on top of the existing border.

### 2. `src/components/candidates/ExpandableScoreDisplay.tsx` (lines 43-52)
- Import and use `useGradientBorder`
- Wrap the banner div with the gradient border effect (outer div with `p-[1px]` and the gradient style, inner div keeps `bg-pastel-purple/30`)
- Change text from `text-virgilio-purple` to `text-foreground` to match the scorecard banner's black text

### 3. `src/components/candidates/ScorecardSheet.tsx` (lines 979-980)
- Import and use `useGradientBorder`
- Wrap the AI Suggested Rating banner with the same gradient border effect

### Text color fix
- "AI Notes Analysis Available": change `text-virgilio-purple` → `text-foreground` (black, matching the other banner)
- "AI Suggested Rating" already uses `text-foreground` — no change needed

### Border approach
The structure for both banners becomes:
```
<div ref={gradientRef} onMouseMove={...} onMouseLeave={...} 
     style={gradientStyle} className="rounded-lg p-[1px]">
  <div className="rounded-[7px] bg-pastel-purple/30 ...">
    {/* content */}
  </div>
</div>
```
The outer div's background is the radial gradient (following cursor), the 1px padding creates the border effect, and the inner div's opaque background covers the rest. When no hover, it falls back to the static `border-pastel-purple/50` color.

