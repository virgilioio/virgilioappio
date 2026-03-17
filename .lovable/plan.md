

# Fix: Prevent AI Hallucination on Unanswered Scorecard Questions

## Problem

The system prompt on line 463 instructs the AI: `"you MUST respond to each with evidence from the transcript"`. This forces the model to fabricate answers for questions that were never discussed during the interview. There is no escape hatch allowing the AI to say "not discussed."

## Solution

Two targeted changes in `supabase/functions/generate-scorecard-from-transcript/index.ts`:

### 1. Update the questions context prompt (line 462-471)

Replace the `SCORECARD QUESTIONS` block with instructions that explicitly tell the AI to mark questions as not discussed when there is no supporting evidence in the transcript. For text questions, set `answer_text` to a phrase like `"[Not discussed during this interview]"`. For yes/no and select questions, set `answer_text` to the same phrase and leave `answer_options` empty.

Key prompt additions:
- "If a question topic was NOT covered in the transcript, do NOT fabricate an answer."
- "For unanswered text questions, set answer_text to exactly: `[Not discussed during this interview]`"
- "For unanswered yes_no/select questions, set answer_options to an empty array and set answer_text to: `[Not discussed during this interview]`"
- "Only provide substantive answers when you can cite specific evidence from the transcript."

### 2. Update the system prompt guidelines (around line 146-155)

Add a top-level guideline reinforcing honesty over completeness:
- "CRITICAL: If a scorecard question topic was not discussed during the interview, explicitly state that rather than inferring or fabricating an answer. Honesty about gaps is more valuable than completeness."

### 3. Update the tool definition description (line 501-503)

Update the `question_responses` description to mention that unanswered questions should still be included but marked as not discussed.

No database changes needed. Single file edit + redeploy of the edge function.

