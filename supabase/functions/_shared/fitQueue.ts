/**
 * Gio Fit queue rules (2026-11-06), shared by process-fit-queue and its tests.
 */

/** The same rule analyze-candidate-fit applies: under 30 characters of text is no description. */
export function hasDescription(description: string | null | undefined): boolean {
  return (description ?? "").replace(/<[^>]*>/g, "").trim().length >= 30;
}

export type Outcome =
  | { kind: "done" }
  | { kind: "waiting" }
  | { kind: "pause"; reason: string }
  | { kind: "retry"; error: string; rateLimited: boolean }
  | { kind: "failed"; error: string };

/** What a reply from analyze-candidate-fit means for the queue row. */
export function outcomeOf(status: number, body: string): Outcome {
  let payload: Record<string, unknown> | null = null;
  try { payload = JSON.parse(body); } catch { /* not JSON */ }
  const error = body.slice(0, 300) || (status ? `HTTP ${status}` : "network_error");
  if (status === 402 || status === 403) return { kind: "pause", reason: `ai_${status}` };
  if (status === 200 && payload?.error === "no_job_description") return { kind: "waiting" };
  if (status === 200 && payload?.success === true) return { kind: "done" };
  if (status === 202 || status === 429 || status === 0 || status >= 500) return { kind: "retry", error, rateLimited: status === 429 };
  return { kind: "failed", error };
}
