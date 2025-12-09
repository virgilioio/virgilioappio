import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GoGioLogo } from '@/components/GoGioLogo';
import { supabase } from '@/integrations/supabase/client';
import { getChromeExtensionRedirectUrl } from '@/constants/chromeExtension';
import { Chrome, LogIn } from 'lucide-react';

/**
 * Chrome OAuth Start Page
 * 
 * This page is opened by the Chrome extension via chrome.identity.launchWebAuthFlow.
 * 
 * Flow:
 * 1. Check if user has an active Supabase session
 * 2. If logged in: Immediately redirect to Chrome extension callback with access token
 * 3. If not logged in: Show login prompt with redirect back to this page
 */
export default function ChromeOAuthStart() {
  const navigate = useNavigate();
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      try {
        // First check if there's any session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[ChromeOAuth] Session error:', sessionError);
          setError('Failed to check authentication status');
          setIsChecking(false);
          return;
        }

        if (!session) {
          // No session - show login prompt
          setNeedsLogin(true);
          setIsChecking(false);
          return;
        }

        // Session exists - refresh it to get a fresh, valid access token
        // This is critical: getSession() may return a cached expired token
        console.log('[ChromeOAuth] Session found, refreshing to get fresh token...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session?.access_token) {
          console.error('[ChromeOAuth] Refresh error:', refreshError);
          // Session expired and can't be refreshed - need to login again
          setNeedsLogin(true);
          setIsChecking(false);
          return;
        }

        const freshToken = refreshData.session.access_token;
        console.log('[ChromeOAuth] Got fresh token, length:', freshToken.length);

        // Redirect to Chrome extension with the FRESH token
        const redirectUrl = `${getChromeExtensionRedirectUrl()}#token=${encodeURIComponent(freshToken)}`;
        
        // Use replace to avoid adding to history and ensure clean redirect
        window.location.replace(redirectUrl);
        // Keep checking state true to prevent UI flash before redirect
      } catch (err) {
        console.error('[ChromeOAuth] Unexpected error:', err);
        setError('An unexpected error occurred');
        setIsChecking(false);
      }
    };

    checkSessionAndRedirect();
  }, []);

  const handleLoginClick = () => {
    // Redirect to login with a redirect parameter to come back here
    navigate('/auth?redirect=/chrome-oauth/start');
  };

  // Show loading spinner while checking session
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground">Connecting to GoGio...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <GoGioLogo size="lg" />
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">{error}</p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show login prompt
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-card border border-border rounded-2xl shadow-lg p-8 text-center space-y-6">
            <div className="flex justify-center">
              <GoGioLogo size="lg" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Chrome className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                Connect Chrome Extension
              </h1>
              <p className="text-muted-foreground">
                You need to be logged in to GoGio to connect the Chrome extension.
              </p>
            </div>

            <Button
              onClick={handleLoginClick}
              size="lg"
              className="w-full h-12 text-base font-medium"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Open GoGio Login
            </Button>

            <p className="text-xs text-muted-foreground">
              After logging in, you'll be automatically redirected back to complete the connection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}
