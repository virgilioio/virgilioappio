

## Fix: Comprehensive Language Enforcement for English Prompts

### Problem
Despite previous fixes, the system still returns Spanish job titles, keywords, alt titles, and department names when processing English prompts about roles in non-English-speaking regions. The JD shared was entirely in English, yet the output came back in Spanish.

### Root Causes Identified

**1. Sandwich message is in the wrong position (most critical)**
In `generate-job-spec/index.ts`, the language enforcement message (line 544) comes BEFORE the actual prompt (line 545). The prompt — a long English JD — is the last thing the model reads. GPT-4o-mini has strong recency bias, so the language rule gets overshadowed by the content of the JD and the Spanish examples earlier in the system prompt.

**2. No post-prompt language reminder**
There is no final message AFTER the user's prompt to reinforce the language rule. The "sandwich" technique requires the instruction to wrap AROUND the content, not just precede it.

**3. Research function receives already-Spanish titles**
When `generate-job-spec` returns a Spanish title (e.g., "Gerente del Equipo de Analistas"), that title is passed directly to `research-sourcing-criteria` (line 586). Even though `detected_language` is "English", the Spanish title primes the research AI to generate Spanish keywords and alt titles.

**4. Frontend sanitization is too narrow**
`sanitizeJobTitle` only cleans the `job_title` field. But `alt_titles`, `department`, and `keywords` from research can all be in Spanish too, and they flow directly into the search criteria and project display.

### Solution (4 changes)

**File 1: `supabase/functions/generate-job-spec/index.ts`**

- Move the language enforcement user message to AFTER the actual prompt (swap lines 544-545), so the last thing the model reads is the language rule
- Add an explicit "assistant" priming message that forces the model to acknowledge the language before generating: `{ role: "assistant", content: "I will respond entirely in English." }`
- This creates a true sandwich: system prompt (end) -> prompt -> language reminder (last)

**File 2: `supabase/functions/generate-job-spec/index.ts` (same file, research call)**

- Apply `sanitizeJobTitle` logic server-side before passing `job_title` to `research-sourcing-criteria` (around line 586)
- Add a simple server-side Spanish-to-English title cleanup so the research function never receives a Spanish title

**File 3: `supabase/functions/research-sourcing-criteria/index.ts`**

- When `detected_language` is "English", add an explicit instruction: "All output MUST be in English. Do not use Spanish or any other non-English language for titles, keywords, or reasoning."
- Currently this instruction is only added when `detected_language !== 'English'` (line 78-80), meaning English gets NO language enforcement at all in the research function

**File 4: `src/components/dashboard/AIJobAssistant.tsx`**

- Extend `sanitizeJobTitle` logic to also sanitize `alt_titles` array and `department` field before they go into `search_criteria` and `job_spec_data`
- Create a `sanitizeJobSpec` wrapper that cleans all text fields, not just the title
- Apply it after receiving the AI response (around line 333-335)

### Detailed Changes

#### Change 1: Fix the sandwich order in generate-job-spec

Current (broken):
```
...conversationMessages,
{ role: 'user', content: 'LANGUAGE RULE: ...' },    // <- before prompt
{ role: 'user', content: effectivePrompt }            // <- last (model focuses here)
```

Fixed:
```
...conversationMessages,
{ role: 'user', content: effectivePrompt },            // <- prompt first
{ role: 'user', content: 'FINAL INSTRUCTION: Your response MUST be entirely in English. Every field — job_title, alt_titles, department, recommendations — must be in English. Do NOT use Spanish.' }  // <- last (model focuses here)
```

#### Change 2: Server-side title sanitization before research call

Around line 586, before passing `jobSpec.job_title` to research:
```typescript
// Simple Spanish word replacement for title before research
const SPANISH_TITLE_MAP: Record<string, string> = {
  'Gerente': 'Manager', 'Ingeniero': 'Engineer', 'Desarrollador': 'Developer',
  'Analista': 'Analyst', 'Coordinador': 'Coordinator', 'Especialista': 'Specialist',
  'Líder': 'Lead', 'Jefe': 'Head', 'Supervisor': 'Supervisor', 'Equipo': 'Team',
  'Director': 'Director', 'Consultor': 'Consultant', 'Ejecutivo': 'Executive',
  'del': 'of the', 'de': 'of', 'y': 'and', 'el': 'the', 'la': 'the', 'los': 'the', 'las': 'the',
};

function sanitizeTitleForResearch(title: string, language: string): string {
  if (language !== 'English') return title;
  let sanitized = title;
  for (const [es, en] of Object.entries(SPANISH_TITLE_MAP)) {
    sanitized = sanitized.replace(new RegExp(`\\b${es}\\b`, 'gi'), en);
  }
  return sanitized.replace(/\s+/g, ' ').trim();
}
```

#### Change 3: Add English enforcement to research function

In `research-sourcing-criteria/index.ts`, change line 78-80 from:
```typescript
const languageInstruction = input.detected_language && input.detected_language !== 'English'
  ? `\n\n... Generate in ${input.detected_language}...`
  : '';
```
To:
```typescript
const languageInstruction = input.detected_language && input.detected_language !== 'English'
  ? `\n\n... Generate in ${input.detected_language}...`
  : '\n\nLANGUAGE RULE: ALL output must be in English. Do not use Spanish, Portuguese, or any other language for titles, keywords, or reasoning. Even if the job location is in a non-English-speaking country, all output text must be English.';
```

#### Change 4: Expand frontend sanitization

In `AIJobAssistant.tsx`, create a `sanitizeJobSpec` function that applies the Spanish-to-English mapping to:
- `job_title` (already done)
- `alt_titles` array (NEW)
- `department` (NEW)

And apply it to the generated spec before creating the project.

### Why This Will Work
- The model's last message is now the language rule (recency bias)
- Even if the title slips through in Spanish, it gets caught server-side before research
- The research function now has explicit English enforcement (previously had none for English)
- Frontend catches any remaining Spanish in alt_titles and department
- Four layers of defense instead of one

