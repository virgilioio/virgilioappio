

# Fix AI Enrichment Hallucination

## Root Cause

Two problems in `enrich-candidate-profile/index.ts`:

1. **Fallback creates fake "resume"** (lines 511-528): When no resume text is extractable, the function concatenates whatever exists on the candidate record (even just a name) and sends it to OpenAI. A candidate named "John Smith" with no resume gets enriched as if their name alone is a resume — OpenAI invents an entire career.

2. **No minimum text threshold**: Line 530 only checks `if (!resumeText)` — but 10 characters of garbage or just a name passes this check and triggers full AI extraction.

3. **System prompt encourages invention**: "Extract ALL structured data" and "Be thorough" with no guardrail against fabrication when data is sparse.

## Fix (single file: `supabase/functions/enrich-candidate-profile/index.ts`)

### A. Add minimum text guard (200 chars)

After all text extraction attempts (line 536), before calling `enrichCandidateProfile`, add a hard gate:

```typescript
const MIN_RESUME_LENGTH = 200;
if (resumeText.length < MIN_RESUME_LENGTH) {
  // Mark as not enrichable, don't hallucinate
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await supabase.from('candidates').update({ 
    enrichment_status: 'not_possible',
  }).eq('id', body.candidateId);
  
  return new Response(JSON.stringify({ 
    error: 'Resume text too short or unreadable for enrichment',
    candidateId: body.candidateId 
  }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

### B. Remove dangerous fallback

Remove lines 510-528 (the fallback that builds "resume text" from `candidate_name`, `current_job_title`, `bio`). If no resume attachment text is extractable, the function should return early with a clear "no resume" error — not fabricate input from sparse profile fields.

### C. Add anti-hallucination instruction to system prompt

Add to `SYSTEM_PROMPT` (line 114):

```
CRITICAL: Only extract information that is EXPLICITLY stated in the resume text.
- If a field's information is not present in the text, return null or omit it entirely.
- NEVER infer, guess, or fabricate data that isn't clearly written in the resume.
- If the text is too short, garbled, or unclear to extract meaningful data, return minimal results with only what you can confirm.
```

### D. Add readability check inside `enrichCandidateProfile` function

As a second safety net, at the top of `enrichCandidateProfile` (line 226), add:

```typescript
// Guard: reject text that's too short or unreadable
const readable = resumeText.replace(/[^a-zA-Z0-9\s.,;:!?@\-()\/'"]/g, '');
if (readable.trim().length < 200) {
  await supabase.from('candidates').update({ enrichment_status: 'not_possible' }).eq('id', candidateId);
  return;
}
```

## Summary

| Change | Purpose |
|--------|---------|
| Remove bio/name fallback | Stop fabricating "resume text" from sparse data |
| Add 200-char minimum gate | Reject unreadable/image PDFs and empty resumes |
| Anti-hallucination prompt | Instruct model to return null instead of guessing |
| Inner readability guard | Defense-in-depth for direct callers |

One edge function file changed. No client-side or database changes needed.

