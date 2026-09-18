// Shared fetch wrapper for direct OpenAI API calls.
// Adds an abort timeout (60s by default, overridable per caller) and exactly one
// retry (after 2s) on network errors, 429 responses, or any 5xx response.
// A call cut off by our own timeout is NOT retried: a request that cannot finish
// inside the budget will not finish inside a second identical budget either, and
// retrying it only doubles the time before the caller can report the failure.
// All other responses pass through unchanged so existing caller error handling
// continues to work.

const DEFAULT_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 2_000;

/** Thrown when our own abort timer fired. Distinguishable from a caller abort. */
export class OpenAiTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number, callerName: string) {
    super(`${callerName} timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = 'OpenAiTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

async function attempt(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  callerName: string,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new OpenAiTimeoutError(timeoutMs, callerName);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function shouldRetry(res: Response): boolean {
  return res.status === 429 || (res.status >= 500 && res.status <= 599);
}

export async function openaiFetch(
  url: string,
  init?: RequestInit,
  callerName = 'unknown',
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let firstError: unknown = null;

  try {
    const res = await attempt(url, init, timeoutMs, callerName);
    if (!shouldRetry(res)) return res;
  } catch (err) {
    // Our own budget ran out — fail once, immediately, instead of burning a
    // second full timeout on the same request.
    if (err instanceof OpenAiTimeoutError) {
      console.error(`[openaiFetch] ${callerName} timed out after ${timeoutMs}ms — not retried`);
      throw err;
    }
    firstError = err;
  }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

  try {
    const res = await attempt(url, init, timeoutMs, callerName);
    if (!shouldRetry(res)) return res;
    console.error(`[openaiFetch] ${callerName} failed after retry`, res.status);
    return res;
  } catch (err) {
    console.error(
      `[openaiFetch] ${callerName} failed after retry`,
      firstError ?? err,
    );
    throw err;
  }
}
