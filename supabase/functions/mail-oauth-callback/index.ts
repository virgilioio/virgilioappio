import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight, withRequestCors } from "../_shared/cors.ts";
import { openState } from "../_shared/mailOAuthState.ts";

class OAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // The sealed state (encrypted server-side by mail-oauth-start) identifies
    // the user, so the popup can finish on any allowed Gio address even
    // without a Gio session there. All writes are scoped to that user.
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { code, state }: OAuthCallbackRequest = await req.json();
    if (!code || !state) {
      throw new OAuthError('missing_params', 'Google did not return the sign-in details. Please try again.');
    }

    let stateData;
    try {
      stateData = await openState(state);
    } catch (e) {
      const expired = (e as Error).message === 'state_expired';
      throw new OAuthError(
        expired ? 'state_expired' : 'state_invalid',
        expired ? 'The sign-in took too long and expired. Please try again.' : 'This sign-in link is not valid anymore. Please start again from Gio.',
      );
    }

    // If the popup does have a Gio session, it must be the same person.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    if (bearer && bearer !== Deno.env.get('SUPABASE_ANON_KEY')) {
      const { data: { user: sessionUser } } = await supabase.auth.getUser(bearer);
      if (sessionUser && sessionUser.id !== stateData.user_id) {
        throw new OAuthError('user_mismatch', 'You are signed in to Gio as a different person in this window. Please start again from your own account.');
      }
    }
    const user = { id: stateData.user_id as string };
    const code_verifier = stateData.code_verifier as string;

    // Exchange code for tokens
    const redirectUri = `${stateData.redirect_base}/mail/oauth/callback`;
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
      console.error('Token exchange failed:', tokenResponse.status, errorData, 'redirect_uri:', redirectUri);
      throw new OAuthError('token_exchange_failed', `Google rejected the sign-in (${tokenResponse.status}). Please try again.`, 502);
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
      throw new OAuthError('userinfo_failed', 'Could not read your Google profile. Please try again.', 502);
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    console.log('Fetched Google user info for email:', userInfo.email);

    // Get user's tenant_id
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .limit(1)
      .maybeSingle();

    if (memberError || !memberData) {
      console.error('Failed to fetch user tenant:', memberError);
      throw new OAuthError('no_workspace', 'Your Gio account is not active in a workspace.', 403);
    }

    if (!hasMailAccess && !hasCalendarAccess) {
      throw new OAuthError('scopes_missing', 'Google did not grant access to email or calendar. Please try again and tick every box on the Google screen.');
    }

    // Encrypt the refresh token using the database function
    const { data: encryptedToken, error: encryptError } = await supabase
      .rpc('encrypt_refresh_token', { token: tokens.refresh_token || '' });

    if (encryptError) {
      console.error('Failed to encrypt refresh token:', encryptError);
      throw new OAuthError('encrypt_failed', 'Could not save your Google connection securely.', 500);
    }

    // Store or update mail identity
    const { data: existingIdentity } = await supabase
      .from('user_mail_identities')
      .select('id')
      .eq('user_id', user.id)
      .eq('email_address', userInfo.email)
      .maybeSingle();

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
      throw new OAuthError('store_failed', 'Could not save your Google connection.', 500);
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
        .maybeSingle();

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
                'Authorization': `Bearer ${serviceKey}`,
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

        // Auto-sync the user's Google Calendar timezone into profile + booking config
        try {
          console.log('[mail-oauth-callback] Syncing calendar timezone...');
          const tzResponse = await fetch(
            `${supabaseUrl}/functions/v1/sync-calendar-timezone`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                calendar_identity_id: calendarResult.data.id,
              }),
            }
          );
          if (tzResponse.ok) {
            console.log('[mail-oauth-callback] Timezone sync result:', await tzResponse.json());
          } else {
            console.error('[mail-oauth-callback] Timezone sync failed:', await tzResponse.text());
          }
        } catch (tzError) {
          console.error('[mail-oauth-callback] Error syncing timezone:', tzError);
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
        return_origin: stateData.return_origin ?? null,
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
    console.error('Error in mail-oauth-callback:', error?.code ?? '', error);
    return new Response(
      JSON.stringify({ error: error.message, code: error?.code ?? 'unexpected' }),
      {
        status: error instanceof OAuthError ? error.status : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(withRequestCors(handler));
