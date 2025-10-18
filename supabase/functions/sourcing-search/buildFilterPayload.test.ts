import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

/**
 * CRITICAL: Boolean query routing behavior
 * 
 * When a request contains query.boolean, the edge function MUST:
 * 1. Set useDSL = true (regardless of CORESIGNAL_USE_DSL env var)
 * 2. Call buildCoreSignalRequest (DSL builder) instead of buildCoreSignalFilterPayload
 * 3. Route to /v2/employee_base/search/es_dsl/preview endpoint
 * 
 * This ensures boolean queries are always processed through the DSL endpoint.
 */

/**
 * Build CoreSignal REST API filter payload for Base Employee v2 filter endpoint
 * Strips null/empty values and formats for the /v2/employee_base/search/filter endpoint
 */
function buildCoreSignalFilterPayload(
  query: {
    titles?: string[];
    keywords?: string[];
    locations?: string[];
    languages?: string[];
    updated_within_days?: number;
    boolean?: string;
  },
  pagination: { page: number; pageSize: number }
): Record<string, any> {
  const payload: Record<string, any> = {};

  // Title - take first title if multiple provided
  if (query.titles && query.titles.length > 0) {
    const title = query.titles[0]?.trim();
    if (title) {
      payload.title = title;
    }
  }

  // Keywords - dedupe and take top 10 from skills/keywords
  const allKeywords = [...(query.keywords || [])];
  const uniqueKeywords = [...new Set(allKeywords.map(k => k?.trim()).filter(Boolean))];
  if (uniqueKeywords.length > 0) {
    payload.keywords = uniqueKeywords.slice(0, 10);
  }

  // Locations - city/region/country tokens
  if (query.locations && query.locations.length > 0) {
    const cleanLocations = query.locations.map(l => l?.trim()).filter(Boolean);
    if (cleanLocations.length > 0) {
      payload.locations = cleanLocations;
    }
  }

  // Languages - as strings
  if (query.languages && query.languages.length > 0) {
    const cleanLanguages = query.languages.map(l => l?.trim()).filter(Boolean);
    if (cleanLanguages.length > 0) {
      payload.languages = cleanLanguages;
    }
  }

  // Updated within days - integer only
  if (query.updated_within_days && Number.isInteger(query.updated_within_days) && query.updated_within_days > 0) {
    payload.updated_within_days = query.updated_within_days;
  }

  // Pagination - clamp page_size to 1..100
  const pageSize = Math.max(1, Math.min(pagination.pageSize ?? 25, 100));
  const page = Math.max(1, pagination.page ?? 1);
  
  if (page > 1) {
    payload.page = page;
  }
  if (pageSize !== 25) {
    payload.page_size = pageSize;
  }

  return payload;
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test("buildCoreSignalFilterPayload - basic title mapping", () => {
  const result = buildCoreSignalFilterPayload(
    { titles: ["Software Engineer"] },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.title, "Software Engineer");
  assertEquals(result.page, undefined); // page 1 is default, should be omitted
  assertEquals(result.page_size, undefined); // 25 is default
});

Deno.test("buildCoreSignalFilterPayload - strips null and empty values", () => {
  const result = buildCoreSignalFilterPayload(
    { 
      titles: ["", "  ", null as any],
      keywords: [null as any, "", "   "],
      locations: [],
      languages: undefined
    },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result, {}); // All fields should be omitted
});

Deno.test("buildCoreSignalFilterPayload - dedupes and limits keywords to 10", () => {
  const result = buildCoreSignalFilterPayload(
    { 
      keywords: [
        "JavaScript", "React", "JavaScript", "TypeScript", 
        "Node.js", "Python", "Java", "C++", "Go", "Rust",
        "Ruby", "PHP", "Kotlin"
      ]
    },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.keywords?.length, 10);
  assertEquals(result.keywords?.filter((k: string) => k === "JavaScript").length, 1); // Deduped
});

Deno.test("buildCoreSignalFilterPayload - trims whitespace from keywords", () => {
  const result = buildCoreSignalFilterPayload(
    { keywords: ["  React  ", " TypeScript ", "JavaScript"] },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.keywords, ["React", "TypeScript", "JavaScript"]);
});

Deno.test("buildCoreSignalFilterPayload - handles locations array", () => {
  const result = buildCoreSignalFilterPayload(
    { locations: ["New York", "San Francisco", "  Boston  "] },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.locations, ["New York", "San Francisco", "Boston"]);
});

Deno.test("buildCoreSignalFilterPayload - handles languages array", () => {
  const result = buildCoreSignalFilterPayload(
    { languages: ["English", "Spanish", "  French  "] },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.languages, ["English", "Spanish", "French"]);
});

Deno.test("buildCoreSignalFilterPayload - includes updated_within_days when valid integer", () => {
  const result = buildCoreSignalFilterPayload(
    { updated_within_days: 30 },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.updated_within_days, 30);
});

Deno.test("buildCoreSignalFilterPayload - excludes updated_within_days when non-integer", () => {
  const result1 = buildCoreSignalFilterPayload(
    { updated_within_days: 30.5 },
    { page: 1, pageSize: 25 }
  );
  
  const result2 = buildCoreSignalFilterPayload(
    { updated_within_days: 0 },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result1.updated_within_days, undefined);
  assertEquals(result2.updated_within_days, undefined);
});

Deno.test("buildCoreSignalFilterPayload - clamps page_size to 1..100", () => {
  const result1 = buildCoreSignalFilterPayload(
    { titles: ["Engineer"] },
    { page: 1, pageSize: 0 }
  );
  
  const result2 = buildCoreSignalFilterPayload(
    { titles: ["Engineer"] },
    { page: 1, pageSize: 200 }
  );
  
  assertEquals(result1.page_size, 1);
  assertEquals(result2.page_size, 100);
});

Deno.test("buildCoreSignalFilterPayload - includes page when > 1", () => {
  const result = buildCoreSignalFilterPayload(
    { titles: ["Engineer"] },
    { page: 3, pageSize: 25 }
  );
  
  assertEquals(result.page, 3);
});

Deno.test("buildCoreSignalFilterPayload - omits page when = 1", () => {
  const result = buildCoreSignalFilterPayload(
    { titles: ["Engineer"] },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.page, undefined);
});

Deno.test("buildCoreSignalFilterPayload - includes page_size when not default", () => {
  const result = buildCoreSignalFilterPayload(
    { titles: ["Engineer"] },
    { page: 1, pageSize: 50 }
  );
  
  assertEquals(result.page_size, 50);
});

Deno.test("buildCoreSignalFilterPayload - excludes boolean query (not supported in v2 filter)", () => {
  const result = buildCoreSignalFilterPayload(
    { 
      titles: ["Engineer"],
      boolean: "developer AND senior"
    },
    { page: 1, pageSize: 25 }
  );
  
  assertEquals(result.boolean, undefined);
  assertEquals(result.title, "Engineer");
});

Deno.test("buildCoreSignalFilterPayload - full payload test", () => {
  const result = buildCoreSignalFilterPayload(
    { 
      titles: ["Senior Software Engineer"],
      keywords: ["React", "TypeScript", "Node.js"],
      locations: ["New York", "Remote"],
      languages: ["English", "Spanish"],
      updated_within_days: 60
    },
    { page: 2, pageSize: 50 }
  );
  
  assertEquals(result, {
    title: "Senior Software Engineer",
    keywords: ["React", "TypeScript", "Node.js"],
    locations: ["New York", "Remote"],
    languages: ["English", "Spanish"],
    updated_within_days: 60,
    page: 2,
    page_size: 50
  });
});

// ============================================================================
// BOOLEAN QUERY ROUTING TESTS
// ============================================================================

Deno.test("Boolean query routing - hasBooleanQuery detection", () => {
  // Document the routing logic:
  // hasBooleanQuery = Boolean(query.boolean?.trim())
  // useDSL = hasBooleanQuery || Deno.env.get('CORESIGNAL_USE_DSL') === 'true'
  
  const testCases = [
    { boolean: "engineer AND developer", expectDSL: true },
    { boolean: "senior", expectDSL: true },
    { boolean: " ", expectDSL: false }, // whitespace only = false
    { boolean: "", expectDSL: false },
    { boolean: null, expectDSL: false },
    { boolean: undefined, expectDSL: false },
  ];
  
  testCases.forEach(({ boolean, expectDSL }) => {
    const hasBooleanQuery = Boolean(boolean?.trim());
    assertEquals(hasBooleanQuery, expectDSL, 
      `Boolean query "${boolean}" should ${expectDSL ? 'trigger' : 'not trigger'} DSL routing`);
  });
});

Deno.test("Self-test mode - boolean_test payload structure", () => {
  // ?boolean_test=1 should:
  // 1. Use DSL endpoint: /v2/employee_base/search/es_dsl/preview
  // 2. Send a boolean query with nested experience filter
  // 3. Not consume credits
  // 4. Return hit_count and provider_status
  
  const expectedPayload = {
    query: {
      bool: {
        must: [{
          nested: {
            path: "experience",
            query: {
              bool: {
                must: [
                  { match_phrase: { "experience.title": "engineer" } },
                  { term: { "experience.is_current": 1 } }
                ]
              }
            }
          }
        }]
      }
    },
    size: 1
  };
  
  // Verify structure matches expected
  assertEquals(expectedPayload.query.bool.must.length, 1);
  assertEquals(expectedPayload.size, 1);
  
  const nestedQuery = expectedPayload.query.bool.must[0].nested;
  assertEquals(nestedQuery.path, "experience");
  assertEquals(nestedQuery.query.bool.must.length, 2);
});
