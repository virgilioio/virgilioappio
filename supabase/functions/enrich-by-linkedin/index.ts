import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
const APOLLO_BULK_MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EnrichByLinkedInRequest {
  candidate_ids: string[];  // Existing candidates to enrich (must have linkedin_url)
  user_id?: string;
}

// Check credit availability
async function checkCollectCredit(
  tenantId: string
): Promise<{ available: boolean; remaining: number; usage: any }> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  
  let { data: usage, error } = await supabase
    .from('sourcing_credits_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('billing_cycle_start', currentMonth)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // No usage record exists, create one
    const { data: limits, error: limitsError } = await supabase
      .rpc('get_tenant_credit_limits', { p_tenant_id: tenantId })
      .single();
    
    if (limitsError) {
      console.error('Error getting tenant credit limits:', limitsError);
      throw limitsError;
    }
    
    const { data: newUsage, error: insertError } = await supabase
      .from('sourcing_credits_usage')
      .insert({
        tenant_id: tenantId,
        billing_cycle_start: currentMonth,
        search_credits_limit: limits.search_limit,
        collect_credits_limit: limits.collect_limit
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    usage = newUsage;
  } else if (error) {
    throw error;
  }
  
  const limit = usage.collect_credits_limit;
  const used = usage.collect_credits_used || 0;
  
  return {
    available: used < limit,
    remaining: limit - used,
    usage
  };
}

// Increment collect credit usage
async function incrementCollectCredits(tenantId: string, count: number): Promise<void> {
  const now = new Date();
  const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  for (let i = 0; i < count; i++) {
    const { error } = await supabase.rpc('increment_sourcing_usage', {
      p_tenant_id: tenantId,
      p_billing_cycle_start: billingCycleStart,
      p_credit_type: 'collect'
    });
    
    if (error) {
      console.error('Failed to increment collect credit usage:', error);
      throw error;
    }
  }
  
  console.log(`Successfully incremented ${count} collect credits for tenant ${tenantId}`);
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const requestBody = await req.json();
    
    // Support both singular (candidate_id) and plural (candidate_ids)
    const candidateIds = requestBody.candidate_ids || 
                         (requestBody.candidate_id ? [requestBody.candidate_id] : []);
    const { user_id } = requestBody;

    const idsToEnrich = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : [candidateIds].filter(Boolean);
    
    console.log('🚀 LinkedIn Enrich Request:', { count: idsToEnrich.length });

    if (!idsToEnrich.length) {
      throw new Error('candidate_ids is required');
    }

    if (!APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    // Fetch candidates with their LinkedIn URLs
    const { data: candidates, error: fetchError } = await supabase
      .from('candidates')
      .select('id, linkedin_url, tenant_id, organization_id, apollo_collected_at')
      .in('id', idsToEnrich);

    if (fetchError) {
      throw new Error(`Failed to fetch candidates: ${fetchError.message}`);
    }

    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates found');
    }

    // Filter candidates that have LinkedIn URLs and haven't been enriched
    const candidatesToEnrich = candidates.filter(c => 
      c.linkedin_url && !c.apollo_collected_at
    );

    const alreadyEnriched = candidates.filter(c => c.apollo_collected_at);
    const noLinkedIn = candidates.filter(c => !c.linkedin_url);

    console.log(`📊 ${candidatesToEnrich.length} to enrich, ${alreadyEnriched.length} already enriched, ${noLinkedIn.length} missing LinkedIn URL`);

    if (candidatesToEnrich.length === 0) {
      return new Response(JSON.stringify({
        results: [],
        enriched_count: 0,
        credits_used: 0,
        already_enriched: alreadyEnriched.length,
        missing_linkedin: noLinkedIn.length,
        message: alreadyEnriched.length > 0 
          ? 'All candidates were already enriched' 
          : 'No candidates with LinkedIn URLs found'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Get tenant from first candidate
    const tenantId = candidatesToEnrich[0].tenant_id;
    
    if (!tenantId) {
      throw new Error('Candidate has no tenant_id');
    }

    // Check credit availability
    const creditCheck = await checkCollectCredit(tenantId);
    
    if (!creditCheck.available) {
      console.warn('❌ Monthly contact reveal credit limit reached');
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Limit to available credits
    const toProcess = candidatesToEnrich.slice(0, creditCheck.remaining);
    
    if (toProcess.length < candidatesToEnrich.length) {
      console.warn(`⚠️ Only enriching ${toProcess.length} of ${candidatesToEnrich.length} due to credit limit`);
    }

    console.log(`💳 Credits available: ${creditCheck.remaining}, processing ${toProcess.length} candidates`);

    // Call Apollo bulk_match API with LinkedIn URLs
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apollo-phone-webhook`;
    console.log(`📞 Phone webhook URL: ${webhookUrl}`);
    
    const apolloResponse = await fetch(APOLLO_BULK_MATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      },
      body: JSON.stringify({
        details: toProcess.map(c => ({ linkedin_url: c.linkedin_url })),
        reveal_phone_number: true,
        webhook_url: webhookUrl
      })
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('❌ Apollo API Error:', apolloResponse.status, errorText);
      throw new Error(`Apollo API error: ${apolloResponse.status}`);
    }

    const apolloData = await apolloResponse.json();
    const matches = apolloData.matches || [];
    
    console.log(`✅ Apollo enrichment returned ${matches.length} profiles`);

    // Map LinkedIn URLs to candidate IDs for updating
    const linkedinToCandidate = new Map(
      toProcess.map(c => [c.linkedin_url?.toLowerCase(), c])
    );

    const results: any[] = [];
    let successCount = 0;

    // Process each enriched profile
    for (const person of matches) {
      if (!person) continue;
      
      // Find matching candidate by LinkedIn URL
      const matchingCandidate = linkedinToCandidate.get(person.linkedin_url?.toLowerCase());
      
      if (!matchingCandidate) {
        console.warn(`No matching candidate for LinkedIn: ${person.linkedin_url}`);
        continue;
      }

      // Extract primary phone number
      const phone = person.phone_numbers?.[0]?.sanitized_number || 
                    person.phone_numbers?.[0]?.raw_number || null;

      // Extract all phone numbers with types
      const contactPhones = (person.phone_numbers || []).map((p: any) => ({
        type: p.type || 'other',
        number: p.sanitized_number || p.raw_number || '',
        raw_number: p.raw_number || null
      })).filter((p: any) => p.number);

      // Extract all emails with types
      const contactEmails: any[] = [];
      if (person.email) {
        contactEmails.push({
          type: 'work',
          email: person.email,
          status: person.email_status || null
        });
      }
      if (person.personal_emails && Array.isArray(person.personal_emails)) {
        person.personal_emails.forEach((e: string) => {
          if (e && e !== person.email) {
            contactEmails.push({
              type: 'personal',
              email: e,
              status: null
            });
          }
        });
      }

      // Update existing candidate record
      const { error: updateError } = await supabase
        .from('candidates')
        .update({
          apollo_id: person.id,
          email: person.email || undefined,
          email_status: person.email_status,
          phone: phone || undefined,
          contact_phones: contactPhones.length > 0 ? contactPhones : undefined,
          contact_emails: contactEmails.length > 0 ? contactEmails : undefined,
          role_current: person.title || undefined,
          company_current: person.organization_name || undefined,
          location_city: person.city || undefined,
          location_state: person.state || undefined,
          location_country: person.country || undefined,
          bio: person.headline || undefined,
          apollo_collected_at: new Date().toISOString()
        })
        .eq('id', matchingCandidate.id);

      if (updateError) {
        console.error('Failed to update candidate:', updateError);
        results.push({
          candidate_id: matchingCandidate.id,
          error: updateError.message,
          success: false
        });
        continue;
      }

      console.log('✅ Candidate enriched:', matchingCandidate.id);

      // Store work experience if available
      if (person.employment_history && person.employment_history.length > 0) {
        // First, remove existing work experience to avoid duplicates
        await supabase
          .from('candidate_work_experience')
          .delete()
          .eq('candidate_id', matchingCandidate.id);

        const experienceRecords = person.employment_history.map((exp: any) => ({
          candidate_id: matchingCandidate.id,
          company_name: exp.organization_name || 'Unknown Company',
          job_title: exp.title || 'Unknown Title',
          start_date: exp.start_date ? new Date(exp.start_date).toISOString().split('T')[0] : null,
          end_date: exp.end_date ? new Date(exp.end_date).toISOString().split('T')[0] : null,
          is_current: exp.current || false,
          description: exp.description
        }));

        const { error: expError } = await supabase
          .from('candidate_work_experience')
          .insert(experienceRecords);

        if (expError) {
          console.warn('Failed to store work experience:', expError);
        }
      }

      successCount++;
      results.push({
        candidate_id: matchingCandidate.id,
        apollo_id: person.id,
        email: person.email,
        phone: phone,
        success: true
      });
    }

    // Increment credit usage for successful enrichments
    if (successCount > 0) {
      await incrementCollectCredits(tenantId, successCount);
    }

    return new Response(JSON.stringify({
      results,
      enriched_count: successCount,
      credits_used: successCount,
      credits_remaining: creditCheck.remaining - successCount,
      already_enriched: alreadyEnriched.length,
      missing_linkedin: noLinkedIn.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ LinkedIn enrich error:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
