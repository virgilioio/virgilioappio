// Fetches the live jobs sitemap from the Supabase edge function and writes it
// to public/jobs-sitemap.xml so it is served same-origin from app.gogio.io.
// Google Search Console requires the sitemap to live on the verified domain.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EDGE_URL =
  "https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-jobs-sitemap";
const OUT = resolve("public/jobs-sitemap.xml");

const FALLBACK = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;

const urlCount = (xml: string) => (xml.match(/<url>/g) ?? []).length

async function fetchSitemap(): Promise<string> {
  const res = await fetch(EDGE_URL, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`edge function returned ${res.status}`);
  const xml = await res.text();
  if (!xml.includes("<urlset")) throw new Error("unexpected response body");
  return xml;
}

// Three tries a few seconds apart. If the list still can't be read, the file
// already in public/ stays as it is: a failed fetch must never replace a good
// sitemap with an empty one (Google would be told every job is gone). Only a
// build with no file at all writes the empty one.
async function main() {
  let last: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const xml = await fetchSitemap();
      writeFileSync(OUT, xml);
      console.log(`jobs-sitemap.xml written (${urlCount(xml)} urls)`);
      return;
    } catch (err) {
      last = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  const message = (last as Error)?.message ?? String(last);
  if (existsSync(OUT)) {
    const kept = urlCount(readFileSync(OUT, "utf8"));
    console.warn(`[generate-jobs-sitemap] fetch failed (${message}); keeping the existing sitemap (${kept} urls)`);
    return;
  }
  console.warn(`[generate-jobs-sitemap] fetch failed (${message}) and there is no sitemap yet; writing an empty one`);
  writeFileSync(OUT, FALLBACK);
}

main();
