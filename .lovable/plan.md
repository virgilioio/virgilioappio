

# Upgrade "AI Notes Analysis Available" Button Styling

## Change

**`src/components/candidates/ExpandableScoreDisplay.tsx`** (lines 43-50)

Replace the current plain button with a lilac-themed button featuring purple text and an animated multicolor gradient border:

```tsx
<button
  type="button"
  onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
  className="relative flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg bg-pastel-purple/20 hover:bg-pastel-purple/30 transition-all duration-200 group overflow-hidden"
  style={{
    border: '2px solid transparent',
    backgroundClip: 'padding-box',
  }}
>
  {/* Animated multicolor gradient border */}
  <span className="absolute inset-[-2px] rounded-lg bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 -z-10 opacity-60 group-hover:opacity-90 transition-opacity" />
  
  <Sparkles className="h-4 w-4 text-virgilio-purple shrink-0" />
  <span className="text-sm text-virgilio-purple font-semibold">
    AI Notes Analysis Available
  </span>
</button>
```

Key visual details:
- **Background**: Lilac (`bg-pastel-purple/20`) with hover darkening
- **Text**: Purple (`text-virgilio-purple`) with semibold weight
- **Border**: Animated multicolor gradient (purple → pink → blue) using a pseudo-element behind the button, creating a rainbow/AI-themed border effect
- **Sparkles icon**: Also in purple to match
- **Hover**: Gradient border opacity increases, background deepens

