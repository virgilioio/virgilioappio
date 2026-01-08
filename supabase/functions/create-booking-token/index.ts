import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a short alphanumeric token (8 characters)
function generateShortToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      job_id,
      candidate_id,
      jhs_id,
      association_id,
      candidate_name,
      candidate_email,
      job_title,
      stage_name,
      short_code
    } = body;

    // Validate required fields
    if (!job_id || !candidate_id || !association_id || !short_code) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: job_id, candidate_id, association_id, short_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing valid token for this exact context
    const { data: existingToken } = await supabase
      .from('booking_link_tokens')
      .select('token')
      .eq('job_id', job_id)
      .eq('candidate_id', candidate_id)
      .eq('association_id', association_id)
      .eq('short_code', short_code)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingToken) {
      return new Response(
        JSON.stringify({ token: existingToken.token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a new unique token
    let token = generateShortToken();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data: collision } = await supabase
        .from('booking_link_tokens')
        .select('token')
        .eq('token', token)
        .maybeSingle();

      if (!collision) break;
      
      token = generateShortToken();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate unique token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the new token
    const { error: insertError } = await supabase
      .from('booking_link_tokens')
      .insert({
        token,
        job_id,
        candidate_id,
        jhs_id: jhs_id || null,
        association_id,
        candidate_name: candidate_name || null,
        candidate_email: candidate_email || null,
        job_title: job_title || null,
        stage_name: stage_name || null,
        short_code,
        created_by: user.id,
      });

    if (insertError) {
      console.error('Failed to insert token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-booking-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
