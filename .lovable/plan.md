

# Fix AI Suggested Rating Banner — Visual Issues

## Problems
1. **Background too intense** — Using raw `#6F3FF5` purple is blinding. Should use the design system's `pastel-purple` (lilac) color instead, matching how other banners (like `BackgroundEnrichmentBanner`) use soft pastel backgrounds.
2. **"Apply Suggestion" button** — Using custom white border/hover classes instead of a standard button variant from the style guide. Should use `variant="virgilio"` or another appropriate variant.
3. **Apply Suggestion doesn't format text** — When clicking "Apply Suggestion", it only sets the rating but doesn't populate Key Takeaways. The user expects it to also insert the AI analysis into the Key Takeaways editor **with proper HTML formatting** (using `markdownToHtml`).

## Changes — `src/components/candidates/ScorecardSheet.tsx`

### 1. Restyle the banner container
Replace `style={{ backgroundColor: '#6F3FF5' }}` with Tailwind classes using the pastel-purple token:
- `bg-pastel-purple/30 border border-pastel-purple/50`
- All text changes from `text-white` → appropriate dark text colors (`text-foreground`, `text-muted-foreground`)
- Collapsible toggle and analysis section: remove `prose-invert`, use standard dark prose styling
- Border dividers: `border-pastel-purple/30` instead of `border-white/10`

### 2. Fix the "Apply Suggestion" button
Replace the custom-styled outline button with a standard variant:
- Use `variant="virgilio"` `size="sm"` — no custom className overrides

### 3. Make "Apply Suggestion" also populate Key Takeaways
Update `handleAcceptAiSuggestion` to:
- Set the rating (existing behavior)
- Convert `aiAnalysis` to HTML via `markdownToHtml(aiAnalysis)` and call `setOverview(htmlContent)` so the Key Takeaways editor gets the formatted analysis

