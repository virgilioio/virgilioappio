## Diagnosis

The `vercel.json` redirect I added is **not being respected** by Lovable's hosting (served by Cloudflare, not Vercel infrastructure that reads `vercel.json`). Result: `https://app.gogio.io/jobs-sitemap.xml` returns **404**, which is what Google Search Console is reporting.

Meanwhile, the actual sitemap works fine at the Supabase edge function URL (returns `200` with `application/xml`).

## Fix (simplest, functional)

Revert to pointing Google directly at the working URL. No redirect gymnastics.

1. **`public/robots.txt`** — Change the `Sitemap:` line back to the Supabase edge function URL:
   `Sitemap: https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-jobs-sitemap`
   Google fully supports cross-domain sitemaps declared in `robots.txt` (as long as the sitemap URL is verified in Search Console, or you submit it manually in the Sitemaps section).
2. **Delete `vercel.json`** — It's dead code on this host and misleading for future work.
3. **In Google Search Console → Sitemaps**, submit the Supabase URL directly (one-time manual action, I'll remind you in the closing message).

## Why not keep `/jobs-sitemap.xml`?

To make that clean URL work on Lovable hosting we'd need either a) a build-time static XML file (loses freshness — jobs list changes), or b) hosting-level redirect config we don't control. Not worth it — Google doesn't care about the URL's prettiness, only that it resolves.

## Out of scope

No changes to the edge function, frontend routes, or splash component.