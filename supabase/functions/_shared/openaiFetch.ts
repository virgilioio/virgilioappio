// Shared fetch wrapper for direct OpenAI API calls.
// Adds a 60s abort timeout and exactly one retry (after 2s) on network errors,
// 429 responses, or any 5xx response. All other responses pass through
// unchanged so existing caller error handling continues to work.

const TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 2_000;

async function attempt(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
): Promise<Response> {
  let firstError: unknown = null;
  let firstResponse: Response | null = null;

  try {
    const res = await attempt(url, init);
    if (!shouldRetry(res)) return res;
    firstResponse = res;
  } catch (err) {
    firstError = err;
  }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

  try {
    const res = await attempt(url, init);
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
