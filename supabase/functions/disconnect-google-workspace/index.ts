import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    const { data: mailRows, error: mailFetchError } = await supabase
      .from('user_mail_identities')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'gmail');
    if (mailFetchError) throw mailFetchError;

    const { data: calendarRows, error: calendarFetchError } = await supabase
      .from('calendar_identities')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'google');
    if (calendarFetchError) throw calendarFetchError;

    const mailIds = (mailRows ?? []).map((row: { id: string }) => row.id);
    const calendarIds = (calendarRows ?? []).map((row: { id: string }) => row.id);

    if (mailIds.length > 0) {
      const { error } = await supabase
        .from('user_mail_identities')
        .delete()
        .in('id', mailIds);
      if (error) throw error;
    }

    if (calendarIds.length > 0) {
      const { error } = await supabase
        .from('calendar_identities')
        .delete()
        .in('id', calendarIds);
      if (error) throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      disconnected: {
        mail: mailIds.length,
        calendar: calendarIds.length,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[disconnect-google-workspace] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});