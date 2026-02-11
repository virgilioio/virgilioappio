/**
 * Chrome Extension Configuration
 * 
 * This file contains the Chrome extension ID and related helper functions
 * for the OAuth-style authentication flow.
 */

// TODO: Move to environment variable via import.meta.env.VITE_CHROME_EXTENSION_ID
// For now, hardcode the extension ID from Chrome Web Store / dev manifest
export const CHROME_EXTENSION_ID = "nhkooggcjgdckjlpbogeanhohjkndhcj";

export const ALLOWED_EXTENSION_IDS = [
  "nhkooggcjgdckjlpbogeanhohjkndhcj",
  "jgponggkkjcgocipplfgfganalkpjjnn",
];

/**
 * Returns the Chrome extension OAuth callback URL
 * This URL is used by chrome.identity.launchWebAuthFlow to receive the token
 */
export const getChromeExtensionRedirectUrl = () =>
  `https://${CHROME_EXTENSION_ID}.chromiumapp.org/provider_cb`;

/**
 * Validates a Chrome extension redirect URI against the allowlist.
 * Must be https://<allowed-id>.chromiumapp.org/provider_cb
 */
export function validateChromeRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'https:') return false;
    if (url.pathname !== '/provider_cb') return false;
    const match = url.hostname.match(/^([a-z]{32})\.chromiumapp\.org$/);
    if (!match) return false;
    return ALLOWED_EXTENSION_IDS.includes(match[1]);
  } catch {
    return false;
  }
}
