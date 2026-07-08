// Fetches the live jobs sitemap from the Supabase edge function and writes it
// to public/jobs-sitemap.xml so it is served same-origin from app.gogio.io.
// Google Search Console requires the sitemap to live on the verified domain.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EDGE_URL =
  "https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-jobs-sitemap";
const OUT = resolve("public/jobs-sitemap.xml");

const FALLBACK = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;

async function main() {
  try {
    const res = await fetch(EDGE_URL, {
      headers: { Accept: "application/xml" },
    });
    if (!res.ok) throw new Error(`edge function returned ${res.status}`);
    const xml = await res.text();
    if (!xml.includes("<urlset")) throw new Error("unexpected response body");
    writeFileSync(OUT, xml);
    const count = (xml.match(/<url>/g) ?? []).length;
    console.log(`jobs-sitemap.xml written (${count} urls)`);
  } catch (err) {
    console.warn(
      `[generate-jobs-sitemap] fetch failed, writing empty sitemap: ${
        (err as Error).message
      }`,
    );
    writeFileSync(OUT, FALLBACK);
  }
}

main();
