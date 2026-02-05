

# Fix: Polish Notes Should Preserve Input Language

## Problem

The `polish-scorecard-notes` edge function always generates output in **English**, regardless of the language used in the interviewer's raw notes and question responses. If notes are written in Spanish, Portuguese, or any other language, the polished output should match that language.

## Root Cause

The system prompt (lines 95-131) and user prompt (lines 133-150) in `supabase/functions/polish-scorecard-notes/index.ts` are entirely in English and contain no instruction to detect or preserve the input language.

## Solution

Add a language-awareness instruction to the **user prompt** that tells the AI to:

1. Detect the language of the interviewer's raw notes and question responses
2. Generate the entire polished output in that same language
3. Keep section headings in the detected language as well

This is the simplest, most reliable approach -- LLMs are excellent at detecting input language and responding accordingly without needing a separate language detection step.

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/polish-scorecard-notes/index.ts` | Add language-matching instruction to the user prompt |

## Specific Change

At the end of the user prompt (around line 150), add a clear instruction:

```
IMPORTANT - Language Rule: Detect the language used in the "Interviewer's Raw Notes" 
and "Interview Questions & Candidate Responses" sections above. Generate the ENTIRE 
output (including section headings, bullet points, and recommendation) in that SAME 
language. For example, if the notes are in Spanish, write everything in Spanish. 
If in Portuguese, write everything in Portuguese. If in English, write in English. 
Do NOT translate -- match the original language exactly.
```

This single addition ensures:
- Spanish notes produce Spanish polished output
- Portuguese notes produce Portuguese polished output
- English notes continue to work as before
- Mixed-language input defaults to the dominant language of the raw notes

No frontend changes are needed -- the fix is entirely in the edge function prompt.

