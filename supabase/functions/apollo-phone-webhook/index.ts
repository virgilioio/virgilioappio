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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Apollo sends phone data in a people array for bulk_match responses
    const people = payload.people || (payload.person ? [payload.person] : (payload.id ? [payload] : []));
    
    if (!people || people.length === 0) {
      console.error('❌ No people data in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing people data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processing ${people.length} people from webhook`);

    const results: { apolloId: string; phoneUpdated: string | null; status: string }[] = [];

    for (const person of people) {
      if (!person || !person.id) {
        console.warn('⚠️ Skipping person without ID');
        continue;
      }

      const apolloId = person.id;
      
      // Extract phone number from the person object
      let phoneNumber: string | null = null;
      let contactPhones: { type: string; number: string; raw_number?: string | null }[] = [];
      
      if (person.phone_numbers && person.phone_numbers.length > 0) {
        phoneNumber = person.phone_numbers[0].sanitized_number || 
                      person.phone_numbers[0].raw_number || 
                      null;
        // Extract all phone numbers with types
        contactPhones = person.phone_numbers.map((p: any) => ({
          type: p.type || 'other',
          number: p.sanitized_number || p.raw_number || '',
          raw_number: p.raw_number || null
        })).filter((p: any) => p.number);
        console.log(`📱 Found ${contactPhones.length} phones for ${apolloId}, primary: ${phoneNumber}`);
      } else if (person.sanitized_phone) {
        phoneNumber = person.sanitized_phone;
        contactPhones = [{ type: 'other', number: phoneNumber, raw_number: null }];
      } else if (person.phone) {
        phoneNumber = person.phone;
        contactPhones = [{ type: 'other', number: phoneNumber, raw_number: null }];
      }

      if (!phoneNumber) {
        console.log(`ℹ️ No phone number for Apollo ID: ${apolloId}`);
        results.push({ apolloId, phoneUpdated: null, status: 'no_phone_in_payload' });
        continue;
      }

      // Find and update the candidate by apollo_id
      const { data: candidate, error: findError } = await supabase
        .from('candidates')
        .select('id, candidate_name, phone, contact_phones')
        .eq('apollo_id', apolloId)
        .maybeSingle();

      if (findError) {
        console.error(`❌ Error finding candidate ${apolloId}:`, findError);
        results.push({ apolloId, phoneUpdated: null, status: 'db_error' });
        continue;
      }

      if (!candidate) {
        console.warn(`⚠️ No candidate found with apollo_id: ${apolloId}`);
        results.push({ apolloId, phoneUpdated: null, status: 'not_found' });
        continue;
      }

      // Only update if the candidate doesn't already have a phone number
      if (candidate.phone) {
        console.log(`ℹ️ Candidate ${candidate.candidate_name} already has phone: ${candidate.phone}`);
        results.push({ apolloId, phoneUpdated: null, status: 'already_has_phone' });
        continue;
      }

      // Update the candidate with the phone number(s)
      const { error: updateError } = await supabase
        .from('candidates')
        .update({ 
          phone: phoneNumber,
          contact_phones: contactPhones.length > 0 ? contactPhones : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.id);

      if (updateError) {
        console.error(`❌ Error updating phone for ${candidate.candidate_name}:`, updateError);
        results.push({ apolloId, phoneUpdated: null, status: 'update_error' });
        continue;
      }

      console.log(`✅ Updated ${contactPhones.length} phone(s) for ${candidate.candidate_name}, primary: ${phoneNumber}`);
      results.push({ apolloId, phoneUpdated: phoneNumber, status: 'updated' });
    }

    const updatedCount = results.filter(r => r.status === 'updated').length;
    console.log(`📊 Webhook complete: ${updatedCount}/${people.length} phones updated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: people.length,
        updated: updatedCount,
        results
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
