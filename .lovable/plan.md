## Why Google rejected the Supabase URL

Google Search Console requires the sitemap to live on the **same verified property** as the URLs inside it. Since your property is `app.gogio.io` (or `gogio.io`) and the sitemap lives on `etrxjxstjfcozdjumfsj.supabase.co`, GSC refuses it as "doesn't belong to the domain." Cross-domain sitemaps in `robots.txt` are technically allowed by the spec, but GSC's Sitemaps submission tool blocks them unless *both* domains are verified — and you can't verify a Supabase subdomain you don't own.

So the sitemap **must** be served from `app.gogio.io/...`. Since Lovable hosting doesn't honor `vercel.json` or custom redirects, the only working path is to **generate a static file at build time** and put it in `public/`.

## Plan

Generate `public/jobs-sitemap.xml` during the build by querying Supabase with the same logic the edge function uses. Every time you publish, the sitemap refreshes with current jobs.

### Steps

1. **Create `scripts/generate-jobs-sitemap.ts`** — Node script that:
   - Uses `@supabase/supabase-js` with the anon key from `.env` (public read on `job_postings` + `careers_page_settings` — the edge function's query works with anon if RLS allows; if not, we use the service role key from a build-only env var).
   - Runs the same query as `supabase/functions/generate-jobs-sitemap/index.ts` (active postings, `google_jobs.enabled=true`, resolve org slugs, build URLs for `/virgilio-careers/...`, `/careers/{company}/{slug}`, or `/p/{slug}`).
   - Writes the XML to `public/jobs-sitemap.xml`.

2. **Wire into `package.json`** — Add `"prebuild": "bunx tsx scripts/generate-jobs-sitemap.ts"` (and `predev` if you also want it fresh in dev). If a `prebuild` already exists (e.g. for the main sitemap), chain both.

3. **Update `public/robots.txt`** — Point `Sitemap:` back to `https://app.gogio.io/jobs-sitemap.xml`.

4. **Keep `supabase/functions/generate-jobs-sitemap`** as-is for now (harmless; useful if you ever move to a host that supports redirects). Optional: delete it later.

5. **After publishing**, resubmit `https://app.gogio.io/jobs-sitemap.xml` in GSC. It will validate because it's same-origin.

### Tradeoff (worth naming)

The sitemap refreshes **only when you publish frontend changes**. If jobs change frequently without publishes, Google will still eventually recrawl and pick up changes via the site itself, but the sitemap file won't reflect them until the next publish. Given the volume, this is fine — and it's the only approach that works within Lovable hosting's constraints.

### Out of scope

- No changes to the edge function
- No changes to the splash/loading component
- No changes to `vercel.json` (already deleted)
