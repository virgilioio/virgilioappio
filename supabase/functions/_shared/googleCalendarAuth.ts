type SupabaseAdmin = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export interface FreshCalendarTokenResult {
  accessToken: string | null;
  calendarIdentity: any | null;
  errorCode?: string;
  errorMessage?: string;
}

async function markCalendarExpired(
  supabase: SupabaseAdmin,
  identityId: string,
  message: string,
) {
  await supabase
    .from('calendar_identities')
    .update({ sync_status: 'expired', sync_error_message: message })
    .eq('id', identityId);
}

function tokenExpiryIsUsable(value: string | null | undefined) {
  if (!value) return false;
  const expiresAt = new Date(value);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date();
}

export async function getFreshCalendarAccessToken(
  supabase: SupabaseAdmin,
  userId: string,
): Promise<FreshCalendarTokenResult> {
  const { data: calendarIdentity, error: identityError } = await supabase
    .from('calendar_identities')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (identityError || !calendarIdentity) {
    return {
      accessToken: null,
      calendarIdentity: null,
      errorCode: 'calendar_identity_missing',
      errorMessage: 'Google Calendar is not connected.',
    };
  }

  if (calendarIdentity.access_token && tokenExpiryIsUsable(calendarIdentity.token_expires_at)) {
    return { accessToken: calendarIdentity.access_token, calendarIdentity };
  }

  const { data: decryptedToken, error: decryptError } = await supabase.rpc('decrypt_refresh_token', {
    encrypted_token: calendarIdentity.encrypted_refresh_token,
  });

  if (decryptError || !decryptedToken) {
    const errorMessage = 'Failed to refresh Google Calendar token';
    await markCalendarExpired(supabase, calendarIdentity.id, errorMessage);
    return {
      accessToken: null,
      calendarIdentity,
      errorCode: 'calendar_token_decrypt_failed',
      errorMessage,
    };
  }

  const tokenRefreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: decryptedToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRefreshResponse.ok) {
    const body = await tokenRefreshResponse.text();
    const errorMessage = body.includes('invalid_grant')
      ? 'Google access was revoked or expired. Please reconnect Google Workspace.'
      : `Token refresh failed: ${tokenRefreshResponse.status}`;
    console.error('[googleCalendarAuth] Token refresh failed:', body);
    await markCalendarExpired(supabase, calendarIdentity.id, errorMessage);
    return {
      accessToken: null,
      calendarIdentity,
      errorCode: 'calendar_token_refresh_failed',
      errorMessage,
    };
  }

  const refreshData = await tokenRefreshResponse.json();
  const accessToken = refreshData.access_token as string;
  const tokenExpiresAt = new Date(Date.now() + Number(refreshData.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from('calendar_identities')
    .update({
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
      sync_status: 'healthy',
      sync_error_message: null,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', calendarIdentity.id);

  return {
    accessToken,
    calendarIdentity: {
      ...calendarIdentity,
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
      sync_status: 'healthy',
      sync_error_message: null,
    },
  };
}