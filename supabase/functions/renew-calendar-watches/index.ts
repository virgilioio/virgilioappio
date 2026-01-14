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

    console.log('[renew-calendar-watches] Starting webhook renewal check');

    // Find webhooks expiring within 24 hours
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: expiringWatches, error: fetchError } = await supabase
      .from('calendar_identities')
      .select('*')
      .lt('webhook_expiration', tomorrow)
      .eq('is_active', true)
      .not('webhook_channel_id', 'is', null);

    if (fetchError) {
      console.error('[renew-calendar-watches] Error fetching expiring watches:', fetchError);
      throw fetchError;
    }

    if (!expiringWatches || expiringWatches.length === 0) {
      console.log('[renew-calendar-watches] No expiring watches found');
      return new Response(
        JSON.stringify({ success: true, renewed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[renew-calendar-watches] Found ${expiringWatches.length} expiring watches`);

    let renewed = 0;
    let failed = 0;

    for (const identity of expiringWatches) {
      try {
        // Call setup-calendar-watch directly via HTTP with service role key
        const functionUrl = `${supabaseUrl}/functions/v1/setup-calendar-watch`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            calendar_identity_id: identity.id,
            is_service_call: true 
          }),
        });
        
        const renewError = !response.ok ? await response.text() : null;

        if (renewError) {
          console.error(`[renew-calendar-watches] Failed to renew watch for ${identity.id}:`, renewError);
          failed++;
        } else {
          console.log(`[renew-calendar-watches] Successfully renewed watch for ${identity.id}`);
          renewed++;
        }
      } catch (error) {
        console.error(`[renew-calendar-watches] Error renewing watch for ${identity.id}:`, error);
        failed++;
      }
    }

    console.log(`[renew-calendar-watches] Renewal complete: ${renewed} renewed, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, renewed, failed }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[renew-calendar-watches] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
