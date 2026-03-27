

# Lilac-Themed Progress Bar for Suggested Candidates Loader

## Colors (from the tab system)

| Element | Value | Source |
|---------|-------|--------|
| Fill gradient start | `#d7c5fb` (Lilac Frost) | Tab active background |
| Fill gradient end | `#6F3FF5` (Virgilio Purple) | Brand purple |
| Track background | `bg-muted` (`--muted`) | Matches tab container bg |
| Glow | `rgba(215, 197, 251, 0.4)` | Lilac-based shadow |
| Percentage text | `#0d0d09` or white | Tab active text color |

## Implementation

**File**: `src/components/sourcing/SuggestedCandidatesLoader.tsx`

Replace the current `<Progress>` component with a custom pill bar:

- **Track**: `w-64 h-6 rounded-full bg-muted border border-border/50 overflow-hidden`
- **Fill**: Inner div with `bg-gradient-to-r from-[#d7c5fb] to-[#6F3FF5]`, `rounded-full`, `transition-all duration-150 ease-out`, `shadow-[0_0_12px_rgba(215,197,251,0.4)]`
- **Width**: driven by existing `progress` state (fast to 85%, crawl to 99%)
- **Percentage label**: small white bold text inside the fill, right-aligned (`pr-2`), only shown when progress > 15% (so it doesn't clip)

```text
Track:  [░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  bg-muted
Fill:   [████████████████████ 84%     ]  lilac → purple gradient + glow
```

Keep all existing logic (non-linear progress, rotating messages, GioLoader) unchanged — only the bar visual changes.

## Files changed

| File | Change |
|------|--------|
| `src/components/sourcing/SuggestedCandidatesLoader.tsx` | Replace `<Progress>` with custom lilac gradient bar |

