import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function MailOAuthCallback() {
  const [msg, setMsg] = useState('Connecting your account...');

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        
        if (!code || !state) {
          throw new Error('Missing OAuth parameters');
        }

        const code_verifier = localStorage.getItem(`mail_oauth:${state}:code_verifier`);
        if (!code_verifier) {
          throw new Error('No code_verifier found (state mismatch)');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Session not available');
        }

        const { data, error } = await supabase.functions.invoke('mail-oauth-callback', {
          body: { code, state, code_verifier },
        });

        if (error) {
          throw new Error(error.message || 'Callback failed');
        }

        // Cleanup
        localStorage.removeItem(`mail_oauth:${state}:code_verifier`);
        localStorage.removeItem(`mail_oauth:${state}:provider`);

        // Notify the opener and close
        window.opener?.postMessage(
          { type: 'mail-oauth-success', payload: data },
          window.location.origin
        );
        
        setMsg('Connected! You can close this window.');
        
        // Auto-close after a short delay
        setTimeout(() => {
          window.close();
        }, 1000);
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        
        window.opener?.postMessage(
          { type: 'mail-oauth-error', error: err.message || String(err) },
          window.location.origin
        );
        
        setMsg('Could not connect your account. You can close this window.');
      }
    })();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">{msg}</p>
      </div>
    </div>
  );
}
