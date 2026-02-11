

# Support Multiple Chrome Extension IDs in OAuth Flow

## What Changes

Update `ChromeOAuthStart.tsx` to accept a `redirect_uri` query parameter so multiple Chrome extensions can authenticate, while strictly validating the URI against an allowlist.

## Details

### 1. Add allowlist to `src/constants/chromeExtension.ts`

Add an array of allowed extension IDs and a validation helper:

```typescript
export const ALLOWED_EXTENSION_IDS = [
  "nhkooggcjgdckjlpbogeanhohjkndhcj",
  "jgponggkkjcgocipplfgfganalkpjjnn",
];

export function validateChromeRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    const match = url.hostname.match(/^([a-z]{32})\.chromiumapp\.org$/);
    if (!match) return false;
    if (url.pathname !== '/provider_cb') return false;
    if (url.protocol !== 'https:') return false;
    return ALLOWED_EXTENSION_IDS.includes(match[1]);
  } catch {
    return false;
  }
}
```

### 2. Update `src/pages/ChromeOAuthStart.tsx`

At the top of the component, read and validate `redirect_uri` from the query string:

```typescript
const redirectUriParam = new URLSearchParams(window.location.search).get('redirect_uri');
const validatedRedirectUri = redirectUriParam && validateChromeRedirectUri(redirectUriParam)
  ? redirectUriParam
  : null;
```

If `redirect_uri` is present but invalid, show an error immediately.

On successful auth (line 62), use the validated URI if available, otherwise fall back to existing `getChromeExtensionRedirectUrl()`:

```typescript
const baseRedirect = validatedRedirectUri || getChromeExtensionRedirectUrl();
const redirectUrl = `${baseRedirect}#token=${encodeURIComponent(freshToken)}`;
```

Preserve `redirect_uri` in the login redirect so it survives the auth round-trip:

```typescript
const loginPath = validatedRedirectUri
  ? `/auth?redirect=${encodeURIComponent(`/chrome-oauth/start?redirect_uri=${encodeURIComponent(validatedRedirectUri)}`)}`
  : '/auth?redirect=/chrome-oauth/start';
```

### Files Changed

| File | Change |
|------|--------|
| `src/constants/chromeExtension.ts` | Add `ALLOWED_EXTENSION_IDS` array and `validateChromeRedirectUri()` helper |
| `src/pages/ChromeOAuthStart.tsx` | Read `redirect_uri` from query string, validate against allowlist, use for redirect or fall back to existing behavior |

No routing, no editor logic, no other files affected.
