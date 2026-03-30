

# Fix AI Notes: Dismiss/Delete + Empty Conversation Guard

## Problem

1. **No way to dismiss AI-generated notes.** When an interview didn't happen (no-show), the "AI Notes Analysis Available" banner persists with no delete option. If the interview is rescheduled in the same stage, new AI notes should replace the old ones cleanly.

2. **AI fabricates notes from empty calls.** When the note-taker joins but nobody speaks, the transcript often contains filler/metadata that passes the 100-char minimum. The AI then hallucinates a full analysis using the candidate's resume context instead of stating nothing was discussed.

## Changes

### 1. Add "Dismiss" button to the AI Notes banner

**File**: `src/components/candidates/ExpandableScoreDisplay.tsx`

- Add an `onDismissAiDraft` callback prop
- Render a small "Dismiss" (X or Trash2) icon button on the AI banner, top-right
- On click, call `onDismissAiDraft(firstAiDraft.id)` after a confirmation dialog
- Stop event propagation so clicking dismiss doesn't open the scorecard sheet

**File**: `src/components/candidates/CandidateProfileSheet.tsx`

- Wire the `onDismissAiDraft` prop to delete the AI draft scorecard (delete from `job_stage_scorecards` where `is_ai_draft = true` and `id = scorecardId`) and also delete associated `scorecard_question_responses`
- After deletion, refetch scorecards so the banner disappears
- Use existing `deleteMyScorecard` if the AI draft's `created_by` matches current user, otherwise add a direct delete for AI drafts the user has permission to dismiss (since the draft was created on their behalf)

### 2. Add empty-conversation detection in the edge function

**File**: `supabase/functions/generate-scorecard-from-transcript/index.ts`

- After loading the transcript (line ~144), before calling OpenAI, add a substantive content check:
  - Strip common filler patterns (timestamps, speaker labels like "Speaker 1:", system messages like "recording started", "meeting ended", join/leave notifications)
  - Count remaining words after stripping
  - If fewer than **50 substantive words**, skip the AI call entirely
  - Instead, store a short standard message: `"No substantive conversation took place during this call. The interview may need to be rescheduled."`
  - Still create the AI draft scorecard but with this message as the `general_overview` and a neutral rating
  - Set `ai_suggested_rating` to `null` to signal no real analysis was possible

- Add to the system prompt (line ~146): a new instruction block:
  ```
  CRITICAL — EMPTY OR NEAR-EMPTY TRANSCRIPTS:
  If the transcript contains only greetings, silence markers, or system messages
  with no substantive interview discussion, respond with:
  - general_overview: "No substantive interview discussion took place during this call."
  - suggested_rating: "yes" (neutral default)
  - question_responses: all set to "[No discussion took place during this interview]"
  Do NOT use the candidate's resume, profile, or job description to fabricate
  interview notes. Your analysis must be based solely on what was actually said.
  ```

### 3. Deploy

Deploy the updated `generate-scorecard-from-transcript` edge function.

## Files changed

| File | Change |
|------|--------|
| `src/components/candidates/ExpandableScoreDisplay.tsx` | Add dismiss button + `onDismissAiDraft` prop on AI banner |
| `src/components/candidates/CandidateProfileSheet.tsx` | Wire dismiss handler to delete AI draft + refetch |
| `supabase/functions/generate-scorecard-from-transcript/index.ts` | Add empty-conversation word-count guard + anti-hallucination prompt rule |

