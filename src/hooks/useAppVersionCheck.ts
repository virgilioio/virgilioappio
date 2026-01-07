import { useState, useEffect, useCallback } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const STORAGE_KEY = 'app_initial_html_hash';

export function useAppVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Simple hash function for HTML content
  const hashContent = (content: string): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  };

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch index.html with cache-busting
      const response = await fetch(`/?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) return;
      
      const html = await response.text();
      const currentHash = hashContent(html);
      
      // Get the initial hash stored when app first loaded
      const initialHash = sessionStorage.getItem(STORAGE_KEY);
      
      if (!initialHash) {
        // First load - store the hash
        sessionStorage.setItem(STORAGE_KEY, currentHash);
        return;
      }
      
      // Compare hashes
      if (currentHash !== initialHash) {
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.warn('Version check failed:', error);
    }
  }, []);

  const refresh = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(checkForUpdates, 10000);
    
    // Periodic checks
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  return { updateAvailable, refresh, dismiss };
}
