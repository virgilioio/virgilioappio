// Single source of truth for the OpenAI model ids used by our edge functions.
// Bump models here, not in individual functions.
//
// NOTE: the gpt-5.x family rejects `temperature` and `max_tokens`. Use
// `max_completion_tokens` for output caps and `reasoning_effort` to trade
// latency for depth.

export const AI_MODELS = {
  /** Judgement / analysis / long documents. */
  reasoning: 'gpt-5.1',
  /** High-volume mechanical extraction where a big model adds cost, not quality. */
  extraction: 'gpt-4o-mini',
  /** Raw text/OCR extraction from PDFs (vision path). */
  vision: 'gpt-4o',
} as const;

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';
