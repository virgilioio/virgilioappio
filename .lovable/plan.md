

# Fix: Update Chrome Extension ID to Production

## Problem

The OAuth redirect is using the wrong (dev) extension ID `jgponggkkjcgocipplfgfganalkpjjnn`, causing `DNS_PROBE_FINISHED_NXDOMAIN` because the redirect URL resolves to a non-existent `.chromiumapp.org` domain.

## Changes

Two files need the extension ID updated to `nhkooggcjgdckjlpbogeanhohjkndhcj`:

| File | What changes |
|------|-------------|
| `src/constants/chromeExtension.ts` | Update `CHROME_EXTENSION_ID` constant from old ID to `nhkooggcjgdckjlpbogeanhohjkndhcj` |
| `src/components/settings/ChromeExtensionTokenCard.tsx` | Update the Chrome Web Store URL to use the new extension ID |

This fixes the redirect URL from:
`https://jgponggkkjcgocipplfgfganalkpjjnn.chromiumapp.org/provider_cb`
to:
`https://nhkooggcjgdckjlpbogeanhohjkndhcj.chromiumapp.org/provider_cb`

No edge function changes needed -- the redirect URL is built entirely on the frontend in `ChromeOAuthStart.tsx` using the constant from `chromeExtension.ts`.

