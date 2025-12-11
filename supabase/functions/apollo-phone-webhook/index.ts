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
    console.log('📞 Apollo phone webhook received');

    const payload = await req.json();
    console.log('📦 Webhook payload:', JSON.stringify(payload, null, 2));

    // Apollo sends phone data in a person object
    const person = payload.person || payload;
    
    if (!person || !person.id) {
      console.error('❌ No person ID in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing person ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apolloId = person.id;
    
    // Extract phone number from the payload
    // Apollo can send phone_numbers array or direct phone fields
    let phoneNumber: string | null = null;
    
    if (person.phone_numbers && person.phone_numbers.length > 0) {
      // Prefer sanitized_number, fallback to raw_number
      phoneNumber = person.phone_numbers[0].sanitized_number || 
                    person.phone_numbers[0].raw_number || 
                    null;
      console.log(`📱 Found phone in phone_numbers array: ${phoneNumber}`);
    } else if (person.sanitized_phone) {
      phoneNumber = person.sanitized_phone;
      console.log(`📱 Found sanitized_phone: ${phoneNumber}`);
    } else if (person.phone) {
      phoneNumber = person.phone;
      console.log(`📱 Found phone: ${phoneNumber}`);
    }

    if (!phoneNumber) {
      console.log('ℹ️ No phone number in webhook payload for Apollo ID:', apolloId);
      return new Response(
        JSON.stringify({ success: true, message: 'No phone number in payload' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find and update the candidate by apollo_id
    const { data: candidate, error: findError } = await supabase
      .from('candidates')
      .select('id, candidate_name, phone')
      .eq('apollo_id', apolloId)
      .maybeSingle();

    if (findError) {
      console.error('❌ Error finding candidate:', findError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!candidate) {
      console.warn(`⚠️ No candidate found with apollo_id: ${apolloId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Candidate not found, may not have been collected yet' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only update if the candidate doesn't already have a phone number
    if (candidate.phone) {
      console.log(`ℹ️ Candidate ${candidate.candidate_name} already has phone: ${candidate.phone}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Candidate already has phone number' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the candidate with the phone number
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ 
        phone: phoneNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', candidate.id);

    if (updateError) {
      console.error('❌ Error updating candidate phone:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update candidate', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Updated phone for candidate ${candidate.candidate_name} (${candidate.id}): ${phoneNumber}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        candidate_id: candidate.id,
        phone_updated: phoneNumber
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
