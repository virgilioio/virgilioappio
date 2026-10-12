import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";
import { callerFromRequest, isServiceCall } from "../_shared/caller.ts";
import { creditStatus, creditsFromResponse, recordCredits, phoneWebhookUrl } from "../_shared/apolloCredits.ts";
import { apolloCompany } from "../_shared/apolloPerson.ts";

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
    // Who is asking: a server function (applications, the extension) with the
    // service key, or a signed-in user, never ids from the body (2026-10-11).
    const serviceCall = isServiceCall(req);
    const caller = serviceCall ? null : await callerFromRequest(req, supabase);
    if (!serviceCall && !caller) {
      return new Response(JSON.stringify({ error: 'Sign in to enrich' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    const user_id = caller?.userId ?? null;
    // Automatic enrichment (applications, the Chrome extension) never asks
    // Apollo for the phone: it costs 8 credits more (2026-10-11).
    const withPhone = requestBody.with_phone === true;

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

    // A signed-in user only enriches candidates of their own workspaces.
    const allowed = serviceCall ? candidates : candidates.filter(c => caller!.memberOf(c.tenant_id));

    // Filter candidates that have LinkedIn URLs and haven't been enriched
    const candidatesToEnrich = allowed.filter(c => 
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

    // Check credit availability (Apollo plan and ledger)
    const status = await creditStatus(supabase, tenantId);
    const creditCheck = { available: status.configured && status.remaining > 0, remaining: status.remaining };
    
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

    // Limit to available credits, and to one workspace per call
    const toProcess = candidatesToEnrich.filter(c => c.tenant_id === tenantId).slice(0, creditCheck.remaining);
    
    if (toProcess.length < candidatesToEnrich.length) {
      console.warn(`⚠️ Only enriching ${toProcess.length} of ${candidatesToEnrich.length} due to credit limit`);
    }

    console.log(`💳 Credits available: ${creditCheck.remaining}, processing ${toProcess.length} candidates`);

    // Call Apollo bulk_match API with LinkedIn URLs
    const webhookUrl = withPhone ? await phoneWebhookUrl(tenantId, user_id) : null;
    
    const apolloResponse = await fetch(APOLLO_BULK_MATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      },
      body: JSON.stringify({
        details: toProcess.map(c => ({ linkedin_url: c.linkedin_url })),
        ...(withPhone ? { reveal_phone_number: true, webhook_url: webhookUrl } : {})
      })
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('❌ Apollo API Error:', apolloResponse.status, errorText);
      throw new Error(`Apollo API error: ${apolloResponse.status}`);
    }

    const apolloData = await apolloResponse.json();
    const matches = apolloData.matches || [];
    const cost = creditsFromResponse(apolloData, matches.filter(Boolean).length);
    await recordCredits(supabase, {
      tenantId, kind: 'enrich', people: matches.filter(Boolean).length,
      credits: cost.credits, estimated: cost.estimated, userId: user_id,
      note: requestBody.trigger_source ? `Enrich by LinkedIn (${String(requestBody.trigger_source).slice(0, 40)})` : 'Enrich by LinkedIn',
    });
    
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
      let { error: updateError } = await supabase
        .from('candidates')
        .update({
          apollo_id: person.id,
          email: person.email || undefined,
          email_status: person.email_status,
          phone: phone || undefined,
          contact_phones: contactPhones.length > 0 ? contactPhones : undefined,
          contact_emails: contactEmails.length > 0 ? contactEmails : undefined,
          role_current: person.title || undefined,
          company_current: apolloCompany(person) || undefined,
          location_city: person.city || undefined,
          location_state: person.state || undefined,
          location_country: person.country || undefined,
          bio: person.headline || undefined,
          apollo_collected_at: new Date().toISOString()
        })
        .eq('id', matchingCandidate.id);

      // Another candidate in the workspace already holds this Apollo id: keep
      // the rest of the data and leave the id where it is (Phase 1 merges).
      if (updateError && updateError.code === '23505') {
        const retry = await supabase
          .from('candidates')
          .update({
            email: person.email || undefined,
            email_status: person.email_status,
            phone: phone || undefined,
            contact_phones: contactPhones.length > 0 ? contactPhones : undefined,
            contact_emails: contactEmails.length > 0 ? contactEmails : undefined,
            role_current: person.title || undefined,
            company_current: apolloCompany(person) || undefined,
            location_city: person.city || undefined,
            location_state: person.state || undefined,
            location_country: person.country || undefined,
            bio: person.headline || undefined,
            apollo_collected_at: new Date().toISOString()
          })
          .eq('id', matchingCandidate.id);
        updateError = retry.error;
      }

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


    return new Response(JSON.stringify({
      results,
      enriched_count: successCount,
      credits_used: cost.credits,
      credits_remaining: Math.max(0, creditCheck.remaining - cost.credits),
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
