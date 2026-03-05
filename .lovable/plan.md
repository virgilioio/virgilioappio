

# AI Banner — Taller, Gio Avatar, Lilac Background

## Changes: `src/components/candidates/ExpandableScoreDisplay.tsx`

1. **Import Gio avatar**: Add `import gioAvatar from '@/assets/gio-avatar.png'` and remove `Sparkles` from lucide imports (no longer needed for this banner).

2. **Update the banner inner content** (lines 66-73):
   - Replace `Sparkles` icon with Gio avatar (`<img src={gioAvatar} className="h-8 w-8 rounded-full shrink-0" />`)
   - Change background from `bg-card` to `bg-pastel-purple/30` (lilac, matching AI visual identity)
   - Increase padding from `py-2.5` to `py-4` for a taller banner
   - Keep the cursor-following gradient border effect unchanged

```tsx
<button
  type="button"
  onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
  className="flex items-center gap-3 w-full text-left px-4 py-4 rounded-[6px] bg-pastel-purple/30 transition-all duration-200"
>
  <img src={gioAvatar} alt="Gio" className="h-8 w-8 rounded-full shrink-0" />
  <span className="text-sm text-virgilio-purple font-semibold">AI Notes Analysis Available</span>
</button>
```

