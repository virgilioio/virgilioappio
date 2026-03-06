

# Correction: Use Existing OpenAI API Key (Not Lovable AI Gateway)

The previous plan incorrectly suggested switching to the Lovable AI Gateway. The project already has `OPENAI_API_KEY` configured as a Supabase secret and every existing edge function (`parse-resume`, `enrich-candidate-profile`, `normalize-job-specs`, `extract-candidate-skills`, etc.) calls `api.openai.com` directly.

**The enrichment rewrite will continue using the existing OpenAI API with tool calling** — same pattern, same key, same endpoint. No gateway switch needed.

The rest of the three-phase plan (schema expansion, structured extraction via OpenAI tool calling, profile sheet UI) remains unchanged. Want me to proceed with Phase 1 implementation?

