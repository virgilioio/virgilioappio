

# Fix AI Notes Displaying Raw JSON Instead of Formatted Markdown

## Problem

The `general_overview` field in AI draft scorecards is sometimes stored as a raw JSON object string (e.g., `{ "general_overview": { "overall_impression": "...", "key_strengths": [...] } }`) instead of formatted markdown. This happens when OpenAI's tool call returns a nested object for the `general_overview` property instead of the expected markdown string.

Two of three recent AI drafts have this issue (Alexis García Payán and Rafael Razo Picasso). The Luis Fernando one is fine because it came back as plain markdown.

## Changes

### 1. Edge function: `supabase/functions/generate-scorecard-from-transcript/index.ts`

After parsing the tool call arguments (line ~214), add a check: if `parsed.general_overview` is an object instead of a string, convert it to markdown:

```typescript
let rawOverview = parsed.general_overview || '';
if (typeof rawOverview === 'object') {
  generatedNotes = convertOverviewObjectToMarkdown(rawOverview);
} else {
  generatedNotes = rawOverview;
}
```

Add a helper function `convertOverviewObjectToMarkdown` that handles the known structure:
- `overall_impression` → "## Overall Impression\n{text}"
- `key_strengths` (array) → "## Key Strengths\n- item\n- item"
- `areas_for_development` (array) → "## Areas for Development\n- item"
- `notable_quotes` (array) → "## Notable Quotes\n> quote"
- `recommended_rating` + `justification` → "## Rating: {rating}\n{justification}"

This prevents future scorecards from being stored as JSON.

### 2. Frontend: `src/components/candidates/ScorecardSheet.tsx`

Update `normalizeAiAnalysis` to also detect and handle JSON strings. If the input starts with `{`, try to parse it and convert to markdown using the same structure mapping. This fixes display for the existing broken records without needing a data migration.

### 3. Fix existing data (one-time migration)

Run a migration that finds scorecards where `general_overview` starts with `{` and `is_ai_draft = true`, and converts them to markdown in-place. This ensures the ExpandableScoreDisplay preview text also renders correctly.

## Files

| File | Change |
|------|--------|
| `supabase/functions/generate-scorecard-from-transcript/index.ts` | Add object-to-markdown conversion after parsing |
| `src/components/candidates/ScorecardSheet.tsx` | Update `normalizeAiAnalysis` to handle JSON input |
| Migration SQL | Convert existing JSON `general_overview` records to markdown |

