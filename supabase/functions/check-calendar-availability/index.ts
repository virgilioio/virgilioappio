import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckAvailabilityRequest {
  user_id: string;
  start_date: string; // ISO 8601
  end_date: string;   // ISO 8601
  timezone: string;   // e.g., "America/New_York"
}

interface BusySlot {
  start: string;
  end: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth - support both user JWT and service role key (for internal calls)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    let isServiceRoleCall = false;

    // Check if this is a service role call (internal function-to-function)
    if (token === supabaseServiceKey) {
      console.log('[check-calendar-availability] Service role authentication (internal call)');
      isServiceRoleCall = true;
    } else {
      // Regular user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Unauthorized');
      }
      console.log('[check-calendar-availability] User authenticated:', user.id);
    }

    const { user_id, start_date, end_date, timezone }: CheckAvailabilityRequest = await req.json();

    console.log('[check-calendar-availability] Checking availability for user:', user_id, 'from', start_date, 'to', end_date);

    // 1. Fetch user's calendar identity
    const { data: calendarIdentity, error: identityError } = await supabase
      .from('calendar_identities')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single();

    if (identityError || !calendarIdentity) {
      console.warn('[check-calendar-availability] No active calendar identity found for user:', user_id);
      return new Response(JSON.stringify({
        busy_slots: [],
        calendar_email: null,
        last_synced: null,
        warning: 'No calendar connected',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check if access token is expired
    const now = new Date();
    const expiresAt = new Date(calendarIdentity.token_expires_at);
    let accessToken = calendarIdentity.access_token;

    if (expiresAt <= now) {
      console.log('[check-calendar-availability] Access token expired, refreshing...');

      // Decrypt refresh token
      const { data: decryptedToken, error: decryptError } = await supabase.rpc('decrypt_refresh_token', {
        encrypted_token: calendarIdentity.encrypted_refresh_token,
      });

      if (decryptError || !decryptedToken) {
        console.error('[check-calendar-availability] Failed to decrypt refresh token:', decryptError);
        
        // Mark sync status as expired
        await supabase
          .from('calendar_identities')
          .update({ sync_status: 'expired', sync_error_message: 'Failed to refresh token' })
          .eq('id', calendarIdentity.id);

        return new Response(JSON.stringify({
          busy_slots: [],
          calendar_email: calendarIdentity.email_address,
          last_synced: calendarIdentity.last_sync_at,
          error: 'Calendar token expired - please reconnect',
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Refresh the access token via Google OAuth
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

      const tokenRefreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: decryptedToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenRefreshResponse.ok) {
        console.error('[check-calendar-availability] Token refresh failed:', await tokenRefreshResponse.text());
        
        await supabase
          .from('calendar_identities')
          .update({ sync_status: 'expired', sync_error_message: 'Token refresh failed' })
          .eq('id', calendarIdentity.id);

        return new Response(JSON.stringify({
          busy_slots: [],
          calendar_email: calendarIdentity.email_address,
          last_synced: calendarIdentity.last_sync_at,
          error: 'Calendar token expired - please reconnect',
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshData = await tokenRefreshResponse.json();
      accessToken = refreshData.access_token;

      // Update calendar identity with new access token
      await supabase
        .from('calendar_identities')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          sync_status: 'healthy',
          sync_error_message: null,
        })
        .eq('id', calendarIdentity.id);

      console.log('[check-calendar-availability] Token refreshed successfully');
    }

    // 3. Call Google Calendar API - FreeBusy
    const freeBusyResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: start_date,
        timeMax: end_date,
        timeZone: timezone,
        items: [{ id: 'primary' }], // Check primary calendar
      }),
    });

    if (!freeBusyResponse.ok) {
      const errorText = await freeBusyResponse.text();
      console.error('[check-calendar-availability] Google Calendar API error:', errorText);

      await supabase
        .from('calendar_identities')
        .update({ 
          sync_status: 'error', 
          sync_error_message: `API error: ${freeBusyResponse.status}`,
        })
        .eq('id', calendarIdentity.id);

      return new Response(JSON.stringify({
        busy_slots: [],
        calendar_email: calendarIdentity.email_address,
        last_synced: calendarIdentity.last_sync_at,
        error: 'Failed to fetch calendar data',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const freeBusyData = await freeBusyResponse.json();
    const busySlots: BusySlot[] = freeBusyData.calendars?.primary?.busy || [];

    console.log('[check-calendar-availability] Found', busySlots.length, 'busy slots');

    // 4. Update last_sync_at
    const syncTime = new Date().toISOString();
    await supabase
      .from('calendar_identities')
      .update({ 
        last_sync_at: syncTime,
        sync_status: 'healthy',
        sync_error_message: null,
      })
      .eq('id', calendarIdentity.id);

    return new Response(JSON.stringify({
      busy_slots: busySlots,
      calendar_email: calendarIdentity.email_address,
      last_synced: syncTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[check-calendar-availability] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
