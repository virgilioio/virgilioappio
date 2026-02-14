

## Fix: Enforce English Output When User Prompts in English

### Problem
When prompting in English (e.g., "I need a sales manager in Mexico"), the AI frequently returns job titles, keywords, department names, and the project name in Spanish. This happens because GPT-4o-mini sees Spanish-speaking location context (LATAM, Mexico, etc.) and overrides the explicit language instruction, responding in Spanish despite the prompt being in English.

The project name is constructed as `${job_title} - ${location}`, so a Spanish job title cascades into a Spanish project name, search criteria titles, and keywords.

### Root Cause
The `generate-job-spec` edge function has extensive language instructions in its system prompt, but GPT-4o-mini doesn't always follow them reliably — especially when the geographic context strongly implies a non-English language. The instructions are long and buried among many other directives, making them easy for the model to deprioritize.

### Solution
Two-part fix to make language enforcement more robust:

**1. `supabase/functions/generate-job-spec/index.ts` -- Strengthen language enforcement**
- Move the language instruction to the END of the system prompt (recency bias makes the model more likely to follow it)
- Simplify and make the instruction more forceful with fewer words
- Add a final `user` message right before the actual prompt that acts as a hard reminder: `"LANGUAGE RULE: Respond in English. Do not use Spanish or any other language for text fields."`
- This "sandwich" approach (system prompt + user reminder) is a proven technique to enforce formatting/language constraints with smaller models

**2. `src/components/dashboard/AIJobAssistant.tsx` -- Frontend fallback**
- After receiving the AI response, detect if the `job_title` appears to be in a different language than the prompt
- This is a safety net: if the AI still returns Spanish despite instructions, at minimum the user sees their original prompt language reflected in the project name
- Specifically: if the detected language is English but the returned `job_title` contains common Spanish role words (e.g., "Gerente", "Ingeniero", "Desarrollador"), translate it to the English equivalent using a small lookup map

### File Changes

**`supabase/functions/generate-job-spec/index.ts`**
- Restructure the system prompt to place language enforcement at the very end (after all other instructions) as the last thing the model reads
- Add a dedicated user-role message immediately before the actual prompt:
  ```
  { role: "user", content: "IMPORTANT: All text output must be in English. Do not respond in Spanish." }
  ```
  (Only added when detected language is English but location context suggests non-English region)
- Remove redundant/scattered language instructions from the middle of the prompt to reduce noise

**`src/components/dashboard/AIJobAssistant.tsx`**
- Add a small `sanitizeJobTitle` function that checks if a title returned for an English prompt contains obvious non-English words and maps them to English equivalents
- Apply it to `title` before constructing the project name on line 339
- This covers the most common failure cases (Spanish role words appearing in English-prompted results)

### Why This Approach
- Moving instructions to the end of the prompt exploits recency bias in language models
- The extra user message creates a "sandwich" that is harder for the model to ignore
- The frontend fallback handles edge cases where the model still misbehaves
- No changes to the research function needed -- it already only adds non-English instructions when `detected_language !== 'English'`

