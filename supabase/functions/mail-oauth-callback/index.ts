import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

interface OAuthCallbackRequest {
  code: string;
  state: string;
  code_verifier: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { code, state, code_verifier }: OAuthCallbackRequest = await req.json();

    // Validate state parameter
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
      if (stateData.user_id !== user.id) {
        throw new Error('State validation failed: user mismatch');
      }
      // Check if state is not too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        throw new Error('State validation failed: expired');
      }
    } catch (e) {
      throw new Error('Invalid state parameter');
    }

    // Exchange code for tokens
    const redirectUri = `${Deno.env.get('OAUTH_REDIRECT_BASE')}/mail/oauth/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        code: code,
        code_verifier: code_verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Validate OAuth scopes
    const grantedScopes = tokens.scope ? tokens.scope.split(' ') : [];
    const requiredMailScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ];
    const requiredCalendarScopes = [
      'https://www.googleapis.com/auth/calendar.events',
    ];
    
    const missingMailScopes = requiredMailScopes.filter(scope => !grantedScopes.includes(scope));
    const missingCalendarScopes = requiredCalendarScopes.filter(scope => !grantedScopes.includes(scope));
    
    if (missingMailScopes.length > 0) {
      console.warn('[OAuth] Missing mail scopes:', missingMailScopes);
      console.warn('[OAuth] Granted scopes:', grantedScopes);
    }
    
    if (missingCalendarScopes.length > 0) {
      console.warn('[OAuth] Missing calendar scopes:', missingCalendarScopes);
      console.warn('[OAuth] Granted scopes:', grantedScopes);
    }
    
    const hasMailAccess = missingMailScopes.length === 0;
    const hasCalendarAccess = missingCalendarScopes.length === 0;

    // Fetch user's primary email and profile info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    console.log('Fetched Google user info for email:', userInfo.email);

    // Get user's tenant_id
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single();

    if (memberError) {
      console.error('Failed to fetch user tenant:', memberError);
      throw new Error('Failed to fetch user tenant');
    }

    // Encrypt the refresh token using the database function
    const { data: encryptedToken, error: encryptError } = await supabase
      .rpc('encrypt_refresh_token', { token: tokens.refresh_token || '' });

    if (encryptError) {
      console.error('Failed to encrypt refresh token:', encryptError);
      throw new Error('Failed to encrypt credentials');
    }

    // Store or update mail identity
    const { data: existingIdentity } = await supabase
      .from('user_mail_identities')
      .select('id')
      .eq('user_id', user.id)
      .eq('email_address', userInfo.email)
      .single();

    const identityData = {
      user_id: user.id,
      tenant_id: memberData.tenant_id,
      provider: 'gmail',
      email_address: userInfo.email,
      display_name: userInfo.name || userInfo.email,
      access_token: tokens.access_token,
      refresh_token_encrypted: encryptedToken,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      is_active: hasMailAccess, // Only activate if scopes are granted
      sync_status: hasMailAccess ? 'active' : 'error',
      last_sync_at: new Date().toISOString(),
    };

    let result;
    if (existingIdentity) {
      // Update existing identity
      result = await supabase
        .from('user_mail_identities')
        .update(identityData)
        .eq('id', existingIdentity.id)
        .select()
        .single();
    } else {
      // Insert new identity
      result = await supabase
        .from('user_mail_identities')
        .insert(identityData)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Failed to store mail identity:', result.error);
      throw new Error('Failed to store mail identity');
    }

    if (!hasMailAccess) {
      console.warn('[OAuth] Mail identity created but not active due to missing scopes');
    } else {
      console.log('Successfully stored mail identity for user:', user.id);
    }

    // Also store calendar identity with same credentials (only if calendar scopes granted)
    if (hasCalendarAccess) {
      const calendarIdentityData = {
        user_id: user.id,
        tenant_id: memberData.tenant_id,
        provider: 'google',
        email_address: userInfo.email,
        display_name: userInfo.name || userInfo.email,
        access_token: tokens.access_token,
        encrypted_refresh_token: encryptedToken,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        is_active: true,
        sync_status: 'healthy',
        last_sync_at: new Date().toISOString(),
      };

      const { data: existingCalendarIdentity } = await supabase
        .from('calendar_identities')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_address', userInfo.email)
        .single();

      let calendarResult;
      if (existingCalendarIdentity) {
        calendarResult = await supabase
          .from('calendar_identities')
          .update(calendarIdentityData)
          .eq('id', existingCalendarIdentity.id)
          .select()
          .single();
      } else {
        calendarResult = await supabase
          .from('calendar_identities')
          .insert(calendarIdentityData)
          .select()
          .single();
      }

      if (calendarResult.error) {
        console.error('Failed to store calendar identity:', calendarResult.error);
        // Don't throw - mail identity is already stored successfully
      } else {
        console.log('Successfully stored calendar identity for user:', user.id);
        
        // Automatically setup calendar watch for push notifications
        try {
          console.log('[mail-oauth-callback] Setting up calendar watch...');
          
          const watchResponse = await fetch(
            `${supabaseUrl}/functions/v1/setup-calendar-watch`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                calendar_identity_id: calendarResult.data.id,
              }),
            }
          );

          if (watchResponse.ok) {
            const watchData = await watchResponse.json();
            console.log('[mail-oauth-callback] Calendar watch setup successful:', watchData);
          } else {
            console.error('[mail-oauth-callback] Failed to setup calendar watch');
          }
        } catch (watchError) {
          console.error('[mail-oauth-callback] Error setting up calendar watch:', watchError);
          // Don't fail the whole flow if watch setup fails
        }
      }
    } else {
      console.warn('[OAuth] Skipping calendar identity creation due to missing calendar scopes');
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: userInfo.email,
        identity_id: result.data.id,
        scopes_granted: {
          mail: hasMailAccess,
          calendar: hasCalendarAccess,
        },
        warnings: [
          ...(!hasMailAccess ? ['Missing required mail scopes. Email sending may not work.'] : []),
          ...(!hasCalendarAccess ? ['Missing required calendar scopes. Calendar integration disabled.'] : []),
        ],
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
    console.error('Error in mail-oauth-callback:', error);
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
