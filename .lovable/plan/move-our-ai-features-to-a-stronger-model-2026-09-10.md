# Move our AI features to a stronger model

## What's happening today

Our AI features are split across two paths, and most of the "thinking" ones still run on an older, cheap model:

| Feature | Model today |
| --- | --- |
| Polish notes (scorecards) | GPT-5 mini |
| Candidate fit analysis | GPT-4o mini |
| Suggested candidates scoring | GPT-4o mini |
| Profile summary / enrichment | GPT-4o mini |
| Resume parsing (2 calls) | GPT-4o mini |
| Scorecard from transcript | GPT-4.1 mini |
| Interview transcript processing | GPT-4o |
| Scorecard questions | GPT-4o mini |
| Next steps suggestions | GPT-4o mini |
| Email draft with Gio | GPT-4o mini |
| Job briefing (dashboard) | Gemini 2.5 Flash |
| Ask Gio (job page) | Gemini 2.5 Flash |
| Candidate natural-language search | Gemini 3 Flash |
| Job description generator | Gemini 3 Flash |

Checked against our own OpenAI account: **GPT-5.1** is available to us, alongside GPT-5, GPT-5 mini and GPT-5 nano.

## What I'll change

Upgrade the analysis and writing features to **GPT-5.1**, and leave the cheap high-volume mechanical ones on a small model.

**Upgraded to GPT-5.1** (judgement, reasoning, long documents):
- Polish notes
- Candidate fit analysis
- Suggested candidates scoring
- Profile summary / enrichment
- Scorecard from transcript, and interview transcript processing
- Scorecard questions
- Next steps suggestions
- Email draft with Gio
- Job briefing and Ask Gio (the job dashboards — these move off Gemini onto our OpenAI account)

**Left as-is on a small fast model** (structured extraction and lookups where a bigger model adds cost and latency but not quality):
- Resume field extraction
- Skills extraction / normalisation
- Candidate natural-language search, job spec normalisation, sourcing criteria research

## Trade-offs you should know

- **Quality up, cost up.** GPT-5.1 costs meaningfully more per call than GPT-4o mini. The heaviest-volume upgraded item is profile enrichment (runs on every resume upload) — say the word and I'll keep that one on the smaller model.
- **Slightly slower.** Reasoning models take longer. Polish notes, fit analysis and Ask Gio will feel a few seconds heavier; nothing user-blocking changes.

## Technical notes

- GPT-5.x rejects `temperature` and `max_tokens`. Every upgraded call needs `temperature` removed and `max_tokens` renamed to `max_completion_tokens`, plus an explicit `reasoning_effort` (`low` for short generative tasks, `medium` for fit analysis / transcripts / briefings).
- The two job-dashboard functions (`generate-job-briefing`, `job-ask-gio`) currently POST to the Lovable AI gateway with a Gemini id. They move to our OpenAI endpoint using the same `openaiFetch` wrapper the other functions use (60s timeout + one retry), reading `OPENAI_API_KEY`. `BRIEFING_MODEL` env override stays supported.
- Introduce `supabase/functions/_shared/aiModels.ts` exporting the model ids by purpose so future bumps happen in one file, and point every touched function at it.
- No prompts, tool schemas, response shapes, JSON parsing, or frontend code change. Existing `response_format: json_object` usage stays.
- Chat (`_shared/chatAiClient.ts`, GPT-5 mini/nano via the gateway) is out of scope — that path is already on GPT-5 and has its own model registry.
- After the edits: deploy the touched functions, then exercise Polish notes, a fit analysis, a job briefing and Ask Gio and read the function logs to confirm no parameter-rejection errors.
