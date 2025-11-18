import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

interface OAuthStartRequest {
  provider: 'gmail' | 'outlook';
}

// Generate PKCE code verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleSecureCorsPreFlight(req);
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { provider }: OAuthStartRequest = await req.json();

    // Guard: Check for required environment variables
    const appBase = Deno.env.get('OAUTH_REDIRECT_BASE');
    if (!appBase) {
      console.error('[mail-oauth-start] Missing OAUTH_REDIRECT_BASE');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: OAUTH_REDIRECT_BASE not set' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!googleClientId) {
      console.error('[mail-oauth-start] Missing GOOGLE_CLIENT_ID');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: GOOGLE_CLIENT_ID not set' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Generate state parameter with user_id and timestamp
    const state = btoa(JSON.stringify({
      user_id: user.id,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    }));

    let authUrl: string;
    const redirectUri = `${appBase}/mail/oauth/callback`;

    if (provider === 'gmail') {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly', // Read emails
    'https://www.googleapis.com/auth/gmail.modify', // Mark as read, add labels
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];

      authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
    } else {
      throw new Error('Only Gmail provider is currently supported');
    }

    console.log('OAuth start initiated for user:', user.id, 'provider:', provider);
    
    // Debug logging
    const logLevel = Deno.env.get('LOG_LEVEL');
    if (logLevel === 'debug') {
      console.log('[DEBUG] redirectUri:', redirectUri);
      console.log('[DEBUG] scopes:', scopes.join(' '));
    }

    // Store code_verifier in a temporary table or return it to the client
    // For security, we'll return it to be stored client-side temporarily
    return new Response(
      JSON.stringify({
        auth_url: authUrl,
        code_verifier: codeVerifier,
        state: state,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in mail-oauth-start:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
