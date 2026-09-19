# Fix the stale favicon shown when Gio ATS URLs are shared / indexed

## Diagnosis (verified live)

The favicon Google shows for app.gogio.io is the old teal mascot face. The current Gio mark (black dot + pill on cream) is already what `/favicon.ico` serves — but Google never learns that, because:

1. `index.html` contains **no `<link rel="icon">` at all**, so nothing authoritative tells browsers/crawlers which icon to use.
2. The **PWA manifest** (`public/manifest.json`) declares both icons as the old mascot PNG hosted on an old `gpt-engineer-file-uploads` cloud URL (still returns 200). Google explicitly uses manifest icons as favicon candidates.
3. `index.html`'s preload line, all **9 apple-touch-icon lines**, and the Windows tile meta all point at the same old mascot cloud URL.
4. A stray copy of the old mascot still ships in the project as `public/custom-favicon.png` (referenced nowhere).

The og:image social preview is already the current "gio ats · Find your people." artwork — untouched.

## Changes

1. **Generate current-mark PNGs from the existing `public/favicon.ico`** (256px, current mark) using ImageMagick — no new artwork:
   - `public/favicon.png` (48×48)
   - `public/apple-touch-icon.png` (180×180)
   - `public/favicon-192.png` and `public/favicon-512.png` (manifest)
2. **`index.html`:**
   - Add icon links: `<link rel="icon" href="/favicon.ico" sizes="any">` followed by `<link rel="icon" type="image/png" href="/favicon.png">`.
   - Replace the preload line's old mascot URL with `/favicon.png`.
   - Replace the 9 apple-touch-icon lines with one: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.
   - Point `msapplication-TileImage` at `/favicon.png`.
3. **`public/manifest.json`:** point both icons at `/favicon-192.png` and `/favicon-512.png`; update `name` to "Gio ATS - Find your people" and `short_name` to "Gio ATS" (the manifest currently says "Virgilio.io - Multi-tenant Hiring Platform", which also surfaces if anyone installs the PWA).
4. **Delete `public/custom-favicon.png`** (the old mascot file; unreferenced in code).
5. Build and publish, then verify the served pages (`/favicon.ico`, `/favicon.png`, `/manifest.json`, `index.html` head) carry only current-mark URLs.

## Google refresh (outside our code)

Google caches search favicons aggressively. After publishing, the fix appears when Google re-crawls — days to a few weeks. I'll trigger a re-index request via Google Search Console from this workspace; the user can also request a re-index manually in Search Console for app.gogio.io.

## Acceptance

- Live `/manifest.json` and `index.html` reference only current-mark icons, all served from the site's own domain (no old cloud URLs anywhere).
- `/favicon.ico` unchanged (already correct).
- og:image / twitter:image untouched (already correct).
- Browsers and Google's crawler now have exactly one, current, authoritative icon signal; the old mascot is no longer shipped or referenced.
