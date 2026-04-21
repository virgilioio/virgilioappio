import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateShortToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) token += chars[array[i] % chars.length];
  return token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const {
      job_id, candidate_id, jhs_id, association_id,
      job_title, stage_name,
      booking_config_ids, primary_short_code,
    } = body;

    if (!job_id || !candidate_id || !association_id || !primary_short_code
        || !Array.isArray(booking_config_ids) || booking_config_ids.length < 2) {
      return new Response(JSON.stringify({ error: 'Missing/invalid required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch verified candidate data
    const { data: candidateData, error: candidateError } = await supabase
      .from('candidates')
      .select('candidate_name, email')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidateData) {
      return new Response(JSON.stringify({ error: 'Candidate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Reuse an existing valid group token for the same context if possible
    const { data: existingTokens } = await supabase
      .from('booking_link_tokens')
      .select('token, booking_config_ids')
      .eq('job_id', job_id)
      .eq('candidate_id', candidate_id)
      .eq('association_id', association_id)
      .eq('scheduling_mode', 'group')
      .gt('expires_at', new Date().toISOString());

    if (existingTokens) {
      const sortedReq = [...booking_config_ids].sort().join(',');
      const match = existingTokens.find((t: any) => {
        const ids = t.booking_config_ids || [];
        return [...ids].sort().join(',') === sortedReq;
      });
      if (match) {
        return new Response(JSON.stringify({ token: match.token }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Generate a unique token
    let token = generateShortToken();
    for (let i = 0; i < 5; i++) {
      const { data: collision } = await supabase
        .from('booking_link_tokens').select('token').eq('token', token).maybeSingle();
      if (!collision) break;
      token = generateShortToken();
    }

    const { error: insertError } = await supabase.from('booking_link_tokens').insert({
      token,
      job_id,
      candidate_id,
      jhs_id: jhs_id || null,
      association_id,
      candidate_name: candidateData.candidate_name,
      candidate_email: candidateData.email,
      job_title: job_title || null,
      stage_name: stage_name || null,
      short_code: primary_short_code,
      scheduling_mode: 'group',
      booking_config_ids,
      created_by: user.id,
    });

    if (insertError) {
      console.error('Failed to insert group token:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in create-group-booking-token:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
