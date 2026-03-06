

# Three Changes: Location Format, AI Profile Summary Banner, Skills Repositioning

## 1. Location format — inline comma-separated (both profiles)

**Files**: `IndependentCandidateProfileSheet.tsx` (lines 606-624), `CandidateProfileSheet.tsx` (lines 1432-1450)

Remove the `<Separator />` and the stacked `flex-col` layout. Replace with a single line:

```tsx
{(candidate?.location_city || candidate?.location_state || candidate?.location_country) && (
  <div className="flex items-start gap-2">
    <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
    <span className="text-sm text-text-primary">
      {[candidate.location_city, candidate.location_state, candidate.location_country]
        .filter(Boolean).join(', ')}
    </span>
  </div>
)}
```

No separator, no stacked list — just "City, State, Country" on one line.

## 2. Profile Summary → AI Banner (Collapsible with Copy) — Independent profile

**File**: `IndependentCandidateProfileSheet.tsx`

Replace the current Profile Summary accordion item (lines 391-412) with the **Collapsible Analysis with Copy** banner from the style guide:

- Lilac background (`bg-pastel-purple/30`, `border-pastel-purple/50`)
- `gioAiBannerIcon` (h-10) on the left
- Title: "**AI Profile Summary**"
- Subtitle: brief one-liner like "Executive summary based on candidate profile"
- Collapsible content area (using Radix Collapsible) showing the `ProfileSummaryMarkdown`
- Copy button to copy the summary text to clipboard
- No rating line (removed per instructions)
- When no summary exists, show the empty state inside the banner

**Import** `gioAiBannerIcon` and `Collapsible/CollapsibleTrigger/CollapsibleContent` from existing components. Add `ChevronDown` and `Copy` icons.

## 3. Update the enrichment prompt for shorter summaries

**File**: `supabase/functions/enrich-candidate-profile/index.ts` (line 27)

Change the `profile_summary` description from the current 200-300 word comprehensive summary to:

> "Executive candidate summary in markdown. Structure: 2 short paragraphs (3-5 sentences each) describing the candidate's background and value proposition, followed by '**Key Strengths**' with 3-5 bullet points, then '**Areas for Development**' with 3-5 bullet points. Keep it concise and substantive — no fluff. Total length: 150-200 words max."

This ensures newly enriched candidates get the shorter format. Existing summaries will still render fine.

## 4. Move Skills card below Profile Summary banner

**File**: `IndependentCandidateProfileSheet.tsx`

In the left column accordion, reorder items so Skills comes immediately after Profile Summary (before Work Experience). The new order:
1. Profile Summary (AI banner)
2. Skills
3. Work Experience
4. Education
5. Certifications

## Files changed
- `src/components/candidates/IndependentCandidateProfileSheet.tsx`
- `src/components/candidates/CandidateProfileSheet.tsx`
- `supabase/functions/enrich-candidate-profile/index.ts`

