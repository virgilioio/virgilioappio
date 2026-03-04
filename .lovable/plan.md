

# Auto-Fill Scorecard Questions from AI Transcript Analysis

## Overview
When the AI processes an interview transcript, it will use **tool calling** to return structured per-question responses alongside the general analysis. These responses get saved as `scorecard_question_responses` records linked to the draft scorecard, so the interviewer opens the scorecard and sees every question pre-filled.

## How it works end-to-end

```text
Transcript ingested
  → Edge function fetches scorecard questions (already does this)
  → AI call uses tool_calling to return structured JSON per question
  → Edge function inserts scorecard_question_responses rows
  → Frontend loads them normally (existing code handles this)
  → Interviewer sees pre-filled answers, edits as needed, submits
```

## Changes

### 1. Edge function: `generate-scorecard-from-transcript/index.ts`

**Add a tool definition** for structured question responses. Instead of asking the AI to embed answers in prose, use OpenAI tool calling to get a clean JSON array:

```typescript
tools: [{
  type: "function",
  function: {
    name: "submit_scorecard",
    description: "Submit the interview analysis and per-question responses",
    parameters: {
      type: "object",
      properties: {
        general_overview: { type: "string", description: "Full analysis markdown" },
        suggested_rating: { type: "string", enum: ["strong_yes","yes","no","definitely_no"] },
        question_responses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_id: { type: "string" },
              answer_text: { type: "string" },
              answer_options: { type: "array", items: { type: "string" } }
            },
            required: ["question_id"]
          }
        }
      },
      required: ["general_overview","suggested_rating","question_responses"]
    }
  }
}],
tool_choice: { type: "function", function: { name: "submit_scorecard" } }
```

**Include question IDs** in the prompt so the AI can map responses back:
```
SCORECARD QUESTIONS:
1. [question_id: abc123] "Tell me about your leadership experience" (text)
2. [question_id: def456] "Has relevant technical skills?" (yes_no)
```

**After parsing the tool call response**, insert `scorecard_question_responses` rows:
```typescript
if (scorecardId && questionResponses.length > 0) {
  await supabase.from('scorecard_question_responses').insert(
    questionResponses.map(r => ({
      scorecard_id: scorecardId,
      question_id: r.question_id,
      answer_text: r.answer_text || null,
      answer_options: r.answer_options || null,
    }))
  );
}
```

**Fallback**: If the tool call fails to parse or returns no question_responses, fall back to the current behavior (general overview only, no per-question responses). This ensures reliability.

### 2. Frontend: `ScorecardSheet.tsx` — No changes needed

The existing `loadQuestionsAndResponses` function already loads `scorecard_question_responses` by `scorecard_id` and populates the `responses` state. Since the edge function creates those rows with the correct `scorecard_id` and `question_id`, the UI will automatically show the AI-filled answers when the interviewer opens the scorecard.

### 3. Answer type handling

The AI needs to handle different `answer_type` values correctly:
- **`text`**: Return prose in `answer_text`
- **`yes_no`**: Return `["yes"]` or `["no"]` in `answer_options`
- **`single_select` / `multi_select`**: Return selected option labels in `answer_options` (the prompt will include the available options from the question's `select_options` field)
- **`salary_expectations`**: Skip — too structured for AI to fill reliably

### 4. Prompt adjustments

Update the questions context to include IDs, answer types, and available options so the AI can respond accurately:

```
SCORECARD QUESTIONS (respond to each with evidence from the transcript):
1. [id: abc123] "Describe leadership experience" (type: text) — provide a text answer
2. [id: def456] "Has 3+ years Python?" (type: yes_no) — answer "yes" or "no"
3. [id: ghi789] "Communication level?" (type: single_select, options: Excellent/Good/Fair/Poor) — pick one
```

## Reliability safeguards

1. **Tool calling** guarantees structured output — no regex parsing of prose
2. **Question ID validation**: Before inserting, verify each `question_id` from the AI response exists in the actual questions list; discard any hallucinated IDs
3. **Graceful fallback**: If tool call parsing fails, still save the `general_overview` text (current behavior)
4. **Idempotency**: When updating an existing AI draft scorecard, delete old `scorecard_question_responses` before inserting new ones

