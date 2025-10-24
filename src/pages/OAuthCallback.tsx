import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useMailIdentities();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      handleOAuthCallback.mutate(
        { code, state },
        {
          onSettled: () => {
            // Close popup if opened in popup
            if (window.opener) {
              window.close();
            } else {
              // Otherwise redirect to settings
              navigate('/settings?tab=email');
            }
          },
        }
      );
    } else {
      // No OAuth params, redirect to settings
      navigate('/settings');
    }
  }, [searchParams, handleOAuthCallback, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
