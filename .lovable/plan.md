## Problem

`https://app.gogio.io/jobs-sitemap.xml` is not a configured route. Because this is a Vite SPA, the hosting platform falls back to `index.html` for any unmatched path. That loads the React app and the Gio splash animation, which is what you're seeing. The actual sitemap lives at the Supabase edge-function URL currently listed in `public/robots.txt`.

Google does **not** need `/jobs-sitemap.xml` to work — it already discovers the sitemap via `robots.txt`. But making the clean URL work is nicer for humans, monitoring tools, and future-proofing.

## Proposed fix

Add a server-side redirect so `/jobs-sitemap.xml` returns the real XML sitemap, then point `robots.txt` at the clean URL.

### Files to change

1. **`vercel.json`** (new file at project root)
   - Add a 308 permanent redirect from `/jobs-sitemap.xml` to the Supabase edge function.
   - This runs before the SPA fallback, so the Gio splash never loads for that path.

   ````text
   {
     "redirects": [
       {
         "source": "/jobs-sitemap.xml",
         "destination": "https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-jobs-sitemap",
         "permanent": true
       }
     ]
   }
   ````

2. **`public/robots.txt`**
   - Update the `Sitemap:` line to use the clean URL so Google follows the same path a human would:

   ````text
   Sitemap: https://app.gogio.io/jobs-sitemap.xml
   ````

## Out of scope

- No changes to the splash component itself.
- No changes to the edge function `supabase/functions/generate-jobs-sitemap/index.ts`.
- No frontend routes or React code changes.

## Note on hosting

You mentioned Lovable hosting. Lovable deployments are typically Vercel-based, so `vercel.json` should be respected. If it isn't, the redirect can be migrated to the platform-specific format (`_redirects`, `netlify.toml`, etc.) without changing the overall approach.