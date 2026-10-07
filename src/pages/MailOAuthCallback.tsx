import { useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { BrandDot } from '@/components/ui/BrandDot';

/**
 * Google returns here after consent. This page is public on purpose: the
 * sealed `state` identifies the Gio user server-side, so it works even when
 * this window has no Gio session (e.g. it came back on a different Gio address).
 */
export default function MailOAuthCallback() {
  const [msg, setMsg] = useState('Connecting your account...');

  useEffect(() => {
    const notify = (message: Record<string, unknown>, targetOrigin: string) => {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, targetOrigin);
        }
      } catch (e) {
        console.warn('Could not post message to opener:', e);
      }
    };

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const googleError = params.get('error');

      try {
        if (googleError) {
          throw new Error(
            googleError === 'access_denied'
              ? 'Google access was not granted.'
              : `Google returned an error: ${googleError}`,
          );
        }
        if (!code || !state) throw new Error('Google did not return the sign-in details. Please try again.');

        const { data, error } = await supabase.functions.invoke('mail-oauth-callback', {
          body: { code, state },
        });

        if (error) {
          let details = error.message;
          if (error instanceof FunctionsHttpError) {
            try {
              const body = await error.context.json();
              details = body?.error || details;
            } catch {
              /* keep generic */
            }
          }
          throw new Error(details || 'Could not connect your account.');
        }

        // Legacy cleanup from the old flow.
        localStorage.removeItem(`mail_oauth:${state}:code_verifier`);
        localStorage.removeItem(`mail_oauth:${state}:provider`);

        const target = (data as any)?.return_origin || window.location.origin;
        notify({ type: 'mail-oauth-success', payload: data }, target);

        setMsg('Connected! You can close this window.');
        setTimeout(() => window.close(), 1000);
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        const message = err?.message || String(err);
        // We don't know the opener's address here; the message carries no secrets.
        notify({ type: 'mail-oauth-error', error: message }, '*');
        setMsg(`Could not connect your account: ${message} You can close this window.`);
      }
    })();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-6 text-center">
      <BrandDot message={msg} />
    </div>
  );
}
