import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role key since this is a public endpoint
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get token from query params or body
    let token: string | null = null;
    
    const url = new URL(req.url);
    token = url.searchParams.get('token');
    
    if (!token && req.method === 'POST') {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up the token
    const { data: tokenData, error: lookupError } = await supabase
      .from('booking_link_tokens')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (lookupError) {
      console.error('Error looking up token:', lookupError);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: 'Token not found or expired', context: null }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the booking context in the same format as the original base64 context
    const context = {
      jobId: tokenData.job_id,
      candidateId: tokenData.candidate_id,
      jhsId: tokenData.jhs_id,
      associationId: tokenData.association_id,
      candidateName: tokenData.candidate_name,
      candidateEmail: tokenData.candidate_email,
      jobTitle: tokenData.job_title,
      stageName: tokenData.stage_name,
    };

    return new Response(
      JSON.stringify({ context }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resolve-booking-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
