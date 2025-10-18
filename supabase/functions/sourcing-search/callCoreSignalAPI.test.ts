import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

import { callCoreSignalAPI } from "./index.ts";

type FetchCall = {
  url: string;
  body?: string;
};

function stubFetch(responses: Response[], calls: FetchCall[]) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    calls.push({ url, body: init?.body as string | undefined });

    const response = responses.shift();
    if (!response) {
      throw new Error("No stubbed response remaining for fetch call");
    }

    return Promise.resolve(response);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function resetEnv() {
  [
    "CORESIGNAL_USE_DSL_PREVIEW",
    "CORESIGNAL_PEOPLE_SEARCH_DSL_PATH",
    "CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH",
    "CORESIGNAL_BASE_URL",
    "LOG_LEVEL"
  ].forEach((key) => Deno.env.delete(key));
}

Deno.test("callCoreSignalAPI routes DSL searches to live endpoint by default", async () => {
  resetEnv();

  const calls: FetchCall[] = [];
  const restoreFetch = stubFetch([
    new Response(JSON.stringify({ hits: { hits: [] }, total: 0 }), {
      status: 200,
      headers: { "x-credits-remaining": "5" }
    })
  ], calls);

  try {
    const result = await callCoreSignalAPI(
      "test-key",
      { query: { match_all: {} }, size: 1 },
      "req-live-default",
      true,
      0
    );

    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.coresignal.com/v2/employee_base/search/es_dsl");
    assertEquals(result.endpointType, "dsl-live");
  } finally {
    restoreFetch();
    resetEnv();
  }
});

Deno.test("callCoreSignalAPI falls back to live endpoint when preview fails", async () => {
  resetEnv();
  Deno.env.set("CORESIGNAL_USE_DSL_PREVIEW", "true");

  const calls: FetchCall[] = [];
  const restoreFetch = stubFetch([
    new Response(JSON.stringify({ message: "preview missing" }), { status: 404 }),
    new Response(JSON.stringify({ hits: { hits: [] }, total: 0 }), {
      status: 200,
      headers: { "x-credits-remaining": "3" }
    })
  ], calls);

  try {
    const result = await callCoreSignalAPI(
      "test-key",
      { query: { match_all: {} }, size: 1 },
      "req-preview-fallback",
      true,
      0
    );

    assertEquals(calls.length, 2);
    assertEquals(calls[0].url, "https://api.coresignal.com/v2/employee_base/search/es_dsl/preview");
    assertEquals(calls[1].url, "https://api.coresignal.com/v2/employee_base/search/es_dsl");
    assertEquals(result.endpointType, "dsl-live");
  } finally {
    restoreFetch();
    resetEnv();
  }
});

Deno.test("callCoreSignalAPI honors preview flag when endpoint succeeds", async () => {
  resetEnv();
  Deno.env.set("CORESIGNAL_USE_DSL_PREVIEW", "true");

  const calls: FetchCall[] = [];
  const restoreFetch = stubFetch([
    new Response(JSON.stringify({ hits: { hits: [] }, total: 0 }), {
      status: 200,
      headers: { "x-credits-remaining": "7" }
    })
  ], calls);

  try {
    const result = await callCoreSignalAPI(
      "test-key",
      { query: { match_all: {} }, size: 1 },
      "req-preview-success",
      true,
      0
    );

    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.coresignal.com/v2/employee_base/search/es_dsl/preview");
    assertEquals(result.endpointType, "dsl-preview");
  } finally {
    restoreFetch();
    resetEnv();
  }
});
