

# AI Suggested Rating Banner Redesign

## What changes

The AI Suggested Rating banner in `ScorecardSheet.tsx` (lines 954-969) will be redesigned to:

1. **Purple background** with white text (`bg-[#6F3FF5]`)
2. **Gio avatar** (`gio-avatar.png`) replacing the Sparkles icon
3. **Display the transcript analysis** (the AI-generated `general_overview` content — overall impression, key strengths, areas for development, notable quotes, rating justification) inside the banner in a collapsible, scrollable, well-formatted section
4. **Remove the AI-generated content from the Key Takeaways** rich text editor — when the scorecard is an AI draft, the overview editor starts empty so the interviewer writes their own notes

## Implementation details

### File: `src/components/candidates/ScorecardSheet.tsx`

1. **Import** `gioAvatar` from `@/assets/gio-avatar.png` (already have `gioIcon`)
2. **Add state** for the original AI analysis text: store the `existing.general_overview` value when it's an AI draft into a separate `aiAnalysis` state variable (set once on open, not tied to the editable `overview`)
3. **Add collapsible state** (`showAnalysis`) for the transcript analysis section
4. **Redesign the banner** (lines 954-969):
   - Purple background, rounded, with Gio avatar (32px), rating label, and Apply Suggestion button in the header row
   - Below: a "Show analysis" / "Hide analysis" toggle
   - When expanded: scrollable area (max-h-80) rendering the AI analysis as formatted markdown/HTML using `SafeHtml` component with white text styling
5. **Clear the overview editor for AI drafts**: When loading an AI draft, set `overview` to `""` instead of `existing.general_overview`, so the Key Takeaways field is blank for the interviewer's own notes. The AI analysis lives only in the banner.

### No backend changes needed
The `general_overview` already contains the full AI analysis. We're just changing where it's displayed in the UI.

