import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  identity_id: string;
  email: string;
  status: 'success' | 'error';
  synced?: number;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[Cron] Starting automatic Gmail sync for all accounts...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active mail identities
    const { data: identities, error: fetchError } = await supabase
      .from('user_mail_identities')
      .select('id, email_address, user_id, last_sync_at')
      .eq('sync_status', 'active')
      .not('access_token', 'is', null);

    if (fetchError) {
      console.error('[Cron] Error fetching mail identities:', fetchError);
      throw fetchError;
    }

    if (!identities || identities.length === 0) {
      console.log('[Cron] No active mail identities found');
      return new Response(
        JSON.stringify({ message: 'No active mail identities to sync', total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Cron] Found ${identities.length} active mail identities to sync`);

    const results: SyncResult[] = [];

    // Process each identity with a small delay to avoid rate limits
    for (const identity of identities) {
      try {
        // Skip if synced in the last 10 minutes to avoid duplicate syncs
        if (identity.last_sync_at) {
          const lastSync = new Date(identity.last_sync_at).getTime();
          const now = Date.now();
          const tenMinutes = 10 * 60 * 1000;
          
          if (now - lastSync < tenMinutes) {
            console.log(`[Cron] Skipping ${identity.email_address} - synced ${Math.round((now - lastSync) / 1000 / 60)} minutes ago`);
            results.push({
              identity_id: identity.id,
              email: identity.email_address,
              status: 'success',
              synced: 0,
            });
            continue;
          }
        }

        console.log(`[Cron] Syncing ${identity.email_address}...`);

        // Generate a temporary auth token for this user
        const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: identity.email_address,
        });

        if (authError || !authData) {
          console.error(`[Cron] Failed to generate auth token for ${identity.email_address}:`, authError);
          results.push({
            identity_id: identity.id,
            email: identity.email_address,
            status: 'error',
            error: 'Failed to generate auth token',
          });
          continue;
        }

        // Invoke sync-gmail-messages function
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-gmail-messages', {
          body: { mail_identity_id: identity.id },
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        });

        if (syncError) {
          console.error(`[Cron] Error syncing ${identity.email_address}:`, syncError);
          results.push({
            identity_id: identity.id,
            email: identity.email_address,
            status: 'error',
            error: syncError.message,
          });
        } else {
          console.log(`[Cron] Successfully synced ${identity.email_address}: ${syncData?.synced || 0} new emails`);
          results.push({
            identity_id: identity.id,
            email: identity.email_address,
            status: 'success',
            synced: syncData?.synced || 0,
          });
        }

        // Add 1 second delay between syncs to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[Cron] Unexpected error syncing ${identity.email_address}:`, error);
        results.push({
          identity_id: identity.id,
          email: identity.email_address,
          status: 'error',
          error: error.message,
        });
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0);

    console.log(`[Cron] Sync complete: ${successful} successful, ${failed} failed, ${totalSynced} total emails synced`);

    return new Response(
      JSON.stringify({
        total: identities.length,
        successful,
        failed,
        totalSynced,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[Cron] Fatal error in sync-all-gmail-accounts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
