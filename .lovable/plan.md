
# Fix: Update Chrome Extension ID

## Problem

The Chrome extension ID changed to `jgponggkkjcgocipplfgfganalkpjjnn`, but the codebase still references the old ID `nhkooggcjgdckjlpbogeanhohjkndhcj` in two places. This causes a 400 error because the OAuth redirect URL points to the wrong extension.

## Changes

### 1. `src/constants/chromeExtension.ts` (line 10)

Update the extension ID:
```
"nhkooggcjgdckjlpbogeanhohjkndhcj"  -->  "jgponggkkjcgocipplfgfganalkpjjnn"
```

This fixes the OAuth callback URL used by `ChromeOAuthStart.tsx`.

### 2. `src/components/settings/ChromeExtensionTokenCard.tsx` (line 12)

Update the Chrome Web Store link:
```
.../nhkooggcjgdckjlpbogeanhohjkndhcj  -->  .../jgponggkkjcgocipplfgfganalkpjjnn
```

This fixes the "Install Extension" link shown in Settings.

### No backend changes needed

The CORS config in `supabase/functions/_shared/cors.ts` already allows all `chrome-extension://` origins dynamically, so no edge function updates are required.

## Files Modified

| File | Change |
|------|--------|
| `src/constants/chromeExtension.ts` | Update extension ID constant |
| `src/components/settings/ChromeExtensionTokenCard.tsx` | Update Chrome Web Store URL |

Two-line fix total.
