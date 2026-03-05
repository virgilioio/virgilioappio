

# Align "AI Notes Analysis Available" with the Scorecard AI Banner Design

## Goal
Replace the cursor-following gradient border with the same simple lilac card style used by the AI Suggested Rating banner, creating visual consistency across AI components.

## Changes: `src/components/candidates/ExpandableScoreDisplay.tsx`

### Remove
- The `gradientRef`, `handleMouseMove`, `handleMouseLeave` logic (lines 34-48) — no longer needed
- The outer gradient wrapper div with `p-[1px]` and inline `style` (lines 60-65, 75)

### Replace with
A single div matching the scorecard banner pattern:
```tsx
<div
  className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 cursor-pointer hover:bg-pastel-purple/40 transition-colors"
  onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
>
  <div className="p-4 flex items-center gap-3">
    <img src={gioAvatar} alt="Gio" className="h-6 w-6 rounded-full shrink-0" />
    <span className="text-sm text-virgilio-purple font-semibold">
      AI Notes Analysis Available
    </span>
  </div>
</div>
```

### Result
- **Background**: `bg-pastel-purple/30` (matches scorecard banner exactly)
- **Border**: `border-pastel-purple/50` (matches scorecard banner exactly)
- **Shape**: `rounded-lg` (same)
- **No gradient border**, no refs, no mouse handlers — cleaner code, consistent design

