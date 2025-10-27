import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { calendar_identity_id } = await req.json();

    console.log('[setup-calendar-watch] Setting up watch for calendar:', calendar_identity_id);

    // Fetch calendar identity
    const { data: calIdentity, error: calError } = await supabase
      .from('calendar_identities')
      .select('*')
      .eq('id', calendar_identity_id)
      .eq('user_id', user.id)
      .single();

    if (calError || !calIdentity) {
      throw new Error('Calendar identity not found');
    }

    // Check if token needs refresh
    let accessToken = calIdentity.access_token;
    const now = new Date();
    const expiresAt = new Date(calIdentity.token_expires_at);

    if (expiresAt <= now) {
      console.log('[setup-calendar-watch] Access token expired, refreshing...');

      // Decrypt refresh token
      const { data: decryptedToken, error: decryptError } = await supabase.rpc(
        'decrypt_refresh_token',
        { encrypted_token: calIdentity.encrypted_refresh_token }
      );

      if (decryptError || !decryptedToken) {
        throw new Error('Failed to decrypt refresh token');
      }

      // Refresh token
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: decryptedToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Token refresh failed');
      }

      const refreshData = await tokenResponse.json();
      accessToken = refreshData.access_token;

      // Update token
      await supabase
        .from('calendar_identities')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('id', calendar_identity_id);
    }

    // Generate unique channel ID
    const channelId = `virgilio-calendar-${crypto.randomUUID()}`;
    
    // Webhook URL - this will be our google-calendar-webhook function
    const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`;

    console.log('[setup-calendar-watch] Subscribing to calendar events with webhook:', webhookUrl);

    // Subscribe to calendar events
    const watchResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: calendar_identity_id, // Pass identity ID for verification
          expiration: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        }),
      }
    );

    if (!watchResponse.ok) {
      const errorText = await watchResponse.text();
      console.error('[setup-calendar-watch] Google Calendar watch failed:', errorText);
      throw new Error(`Failed to setup calendar watch: ${watchResponse.status}`);
    }

    const watchData = await watchResponse.json();
    
    console.log('[setup-calendar-watch] Watch setup successful:', watchData);

    // Store webhook details
    await supabase
      .from('calendar_identities')
      .update({
        webhook_channel_id: channelId,
        webhook_resource_id: watchData.resourceId,
        webhook_expiration: new Date(parseInt(watchData.expiration)).toISOString(),
        last_webhook_renewal: new Date().toISOString(),
      })
      .eq('id', calendar_identity_id);

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: channelId,
        expiration: watchData.expiration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[setup-calendar-watch] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
