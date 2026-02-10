/**
 * Chrome Extension Configuration
 * 
 * This file contains the Chrome extension ID and related helper functions
 * for the OAuth-style authentication flow.
 */

// TODO: Move to environment variable via import.meta.env.VITE_CHROME_EXTENSION_ID
// For now, hardcode the extension ID from Chrome Web Store / dev manifest
export const CHROME_EXTENSION_ID = "jgponggkkjcgocipplfgfganalkpjjnn";

/**
 * Returns the Chrome extension OAuth callback URL
 * This URL is used by chrome.identity.launchWebAuthFlow to receive the token
 */
export const getChromeExtensionRedirectUrl = () =>
  `https://${CHROME_EXTENSION_ID}.chromiumapp.org/provider_cb`;
