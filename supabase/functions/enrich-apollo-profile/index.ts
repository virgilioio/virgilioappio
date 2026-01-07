import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
// CORRECT Apollo endpoint for enrichment (bulk_match for IDs)
const APOLLO_BULK_MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';
const APOLLO_BATCH_SIZE = 10; // Apollo API limit per request

// Helper to chunk array into smaller batches
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EnrichRequest {
  apollo_ids: string[];  // Array of Apollo IDs to enrich
  job_id?: string;
  stage_id?: string;
  user_id?: string;
}

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email?: string;
  email_status?: string;
  headline?: string;
  title?: string;
  linkedin_url?: string;
  phone_numbers?: Array<{ raw_number: string; sanitized_number: string; type: string }>;
  organization_name?: string;
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
  departments?: string[];
  employment_history?: Array<{
    organization_name: string;
    title: string;
    start_date?: string;
    end_date?: string;
    current: boolean;
    description?: string;
  }>;
}

// Helper to get tenant_id from organization
async function getTenantIdFromOrganization(organizationId: string): Promise<string> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('tenant_id')
    .eq('id', organizationId)
    .single();
  
  if (error || !org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }
  
  return org.tenant_id;
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

// Increment collect credit usage (for multiple candidates)
async function incrementCollectCredits(tenantId: string, count: number): Promise<void> {
  const now = new Date();
  const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  // Increment multiple times or use a custom RPC
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
    
    // Support both singular (apollo_id from frontend) and plural (apollo_ids for batch)
    const apollo_ids = requestBody.apollo_ids || 
                       (requestBody.apollo_id ? [requestBody.apollo_id] : []);
    const { job_id, stage_id, user_id, sourcing_project_id } = requestBody;

    // Ensure we have an array
    const idsToEnrich = Array.isArray(apollo_ids) ? apollo_ids.filter(Boolean) : [apollo_ids].filter(Boolean);
    
    console.log('🚀 Apollo Enrich Request:', { count: idsToEnrich.length, job_id });

    if (!idsToEnrich.length) {
      throw new Error('apollo_ids is required');
    }

    // Validate API key
    if (!APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    // Get organization and tenant from job if provided, otherwise from user
    let organizationId: string;
    let tenantId: string;
    
    if (job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('organization_id, tenant_id')
        .eq('id', job_id)
        .single();
      
      if (jobError || !job) {
        throw new Error('Job not found');
      }
      
      organizationId = job.organization_id;
      tenantId = job.tenant_id;
    } else if (user_id) {
      // Get user's default organization
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('organization_id, tenant_id')
        .eq('user_id', user_id)
        .eq('user_status', 'active')
        .single();
      
      if (memberError || !member) {
        throw new Error('User membership not found');
      }
      
      organizationId = member.organization_id;
      tenantId = member.tenant_id;
    } else {
      throw new Error('job_id or user_id required');
    }

    // Check which candidates already exist
    const { data: existingCandidates } = await supabase
      .from('candidates')
      .select('id, apollo_id')
      .in('apollo_id', idsToEnrich)
      .eq('tenant_id', tenantId);

    const existingApolloIds = new Set((existingCandidates || []).map(c => c.apollo_id));
    const newApolloIds = idsToEnrich.filter(id => !existingApolloIds.has(id));

    console.log(`📊 ${existingApolloIds.size} already collected, ${newApolloIds.length} new to enrich`);

    // Handle already collected candidates - add to job if needed
    const results: any[] = [];
    
    for (const existing of (existingCandidates || [])) {
      if (job_id) {
        // Check if association exists
        const { data: existingAssoc } = await supabase
          .from('job_candidate_associations')
          .select('id')
          .eq('candidate_id', existing.id)
          .eq('job_id', job_id)
          .maybeSingle();
        
        if (!existingAssoc) {
          // Determine stage
          let targetStageId = stage_id;
          if (!targetStageId) {
            const { data: firstStage } = await supabase
              .from('job_hiring_stages')
              .select('id')
              .eq('job_id', job_id)
              .order('position', { ascending: true })
              .limit(1)
              .single();
            
            targetStageId = firstStage?.id;
          }
          
          await supabase
            .from('job_candidate_associations')
            .insert({
              candidate_id: existing.id,
              job_id: job_id,
              current_stage_id: targetStageId,
              status: 'active',
              added_by: user_id
            });
        }
      }
      
      results.push({
        apollo_id: existing.apollo_id,
        candidate_id: existing.id,
        already_collected: true
      });
    }

    // If no new candidates to enrich, return early
    if (newApolloIds.length === 0) {
      return new Response(JSON.stringify({
        results,
        enriched_count: 0,
        credits_used: 0,
        message: 'All candidates were already collected'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Check credit availability
    const creditCheck = await checkCollectCredit(tenantId);
    
    if (!creditCheck.available) {
      console.warn('❌ Monthly contact reveal credit limit reached');
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0,
        results  // Return already-collected results
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Limit to available credits
    const idsToProcess = newApolloIds.slice(0, creditCheck.remaining);
    
    if (idsToProcess.length < newApolloIds.length) {
      console.warn(`⚠️ Only enriching ${idsToProcess.length} of ${newApolloIds.length} due to credit limit`);
    }

    console.log(`💳 Credits available: ${creditCheck.remaining}, processing ${idsToProcess.length} candidates`);

    // Call Apollo bulk_match API to enrich profiles
    // Apollo bulk_match accepts an array of ID objects
    // Include reveal_phone_number to get phone data via webhook
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apollo-phone-webhook`;
    console.log(`📞 Phone webhook URL: ${webhookUrl}`);
    
    // Split into batches of 10 (Apollo's limit per request)
    const batches = chunkArray(idsToProcess, APOLLO_BATCH_SIZE);
    console.log(`📦 Processing ${idsToProcess.length} candidates in ${batches.length} batch(es)`);

    const allMatches: ApolloPerson[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} candidates)`);
      
      const apolloResponse = await fetch(APOLLO_BULK_MATCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify({
          details: batch.map(id => ({ id })),
          reveal_phone_number: true,
          webhook_url: webhookUrl
        })
      });

      if (!apolloResponse.ok) {
        const errorText = await apolloResponse.text();
        console.error(`❌ Apollo API Error (batch ${i + 1}):`, apolloResponse.status, errorText);
        // Continue with other batches instead of failing completely
        continue;
      }

      const apolloData = await apolloResponse.json();
      const batchMatches = apolloData.matches || [];
      console.log(`✅ Batch ${i + 1} returned ${batchMatches.length} profiles`);
      
      allMatches.push(...batchMatches);
    }

    const matches = allMatches;
    console.log(`✅ Apollo enrichment returned ${matches.length} total profiles from ${batches.length} batch(es)`);

    // Increment credit usage for successful enrichments
    if (matches.length > 0) {
      await incrementCollectCredits(tenantId, matches.length);
    }

    // Process each enriched profile
    for (const person of matches) {
      if (!person) continue;
      
      // Build location string
      const location = [person.city, person.state, person.country]
        .filter(Boolean)
        .join(', ');

      // Extract primary phone number (first one for backward compatibility)
      const phone = person.phone_numbers?.[0]?.sanitized_number || 
                    person.phone_numbers?.[0]?.raw_number || null;

      // Extract all phone numbers with types
      const contactPhones = (person.phone_numbers || []).map((p: any) => ({
        type: p.type || 'other',
        number: p.sanitized_number || p.raw_number || '',
        raw_number: p.raw_number || null
      })).filter((p: any) => p.number);

      // Extract all emails with types
      // Apollo provides primary email + may have additional in contact info
      const contactEmails: any[] = [];
      if (person.email) {
        contactEmails.push({
          type: 'work',
          email: person.email,
          status: person.email_status || null
        });
      }
      // Add any additional emails from Apollo's personal_emails array if present
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

      // Create candidate record
      const { data: newCandidate, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          apollo_id: person.id,
          candidate_name: person.name || `${person.first_name} ${person.last_name}`.trim(),
          email: person.email,
          email_status: person.email_status,
          phone: phone,
          contact_phones: contactPhones,
          contact_emails: contactEmails,
          linkedin_url: person.linkedin_url,
          role_current: person.title,
          company_current: person.organization_name,
          location_city: person.city,
          location_state: person.state,
          location_country: person.country,
          bio: person.headline,
          source: 'apollo',
          organization_id: organizationId,
          tenant_id: tenantId,
          created_by: user_id,
          apollo_collected_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (candidateError) {
        console.error('Failed to create candidate:', candidateError);
        results.push({
          apollo_id: person.id,
          error: candidateError.message,
          already_collected: false
        });
        continue;
      }

      console.log('✅ Candidate created:', newCandidate.id);

      // Mark as collected in the sourcing project
      if (sourcing_project_id) {
        const { error: previewUpdateError } = await supabase
          .from('sourcing_preview_candidates')
          .update({ collected_at: new Date().toISOString() })
          .eq('apollo_id', person.id)
          .eq('sourcing_project_id', sourcing_project_id);
        
        if (previewUpdateError) {
          console.warn('Failed to update preview candidate collected_at:', previewUpdateError);
        }
      }

      // Store work experience if available
      if (person.employment_history && person.employment_history.length > 0) {
        const experienceRecords = person.employment_history.map((exp: any) => ({
          candidate_id: newCandidate.id,
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

      // If job_id provided, add to job pipeline
      if (job_id) {
        let targetStageId = stage_id;
        
        if (!targetStageId) {
          const { data: firstStage } = await supabase
            .from('job_hiring_stages')
            .select('id')
            .eq('job_id', job_id)
            .order('position', { ascending: true })
            .limit(1)
            .single();
          
          targetStageId = firstStage?.id;
        }
        
        const { error: assocError } = await supabase
          .from('job_candidate_associations')
          .insert({
            candidate_id: newCandidate.id,
            job_id: job_id,
            current_stage_id: targetStageId,
            status: 'active',
            added_by: user_id
          });

        if (assocError) {
          console.warn('Failed to add to job pipeline:', assocError);
        }
      }

      results.push({
        apollo_id: person.id,
        candidate_id: newCandidate.id,
        already_collected: false,
        email: person.email,
        phone: phone
      });
    }

    const enrichedCount = results.filter(r => !r.already_collected && !r.error).length;

    return new Response(JSON.stringify({
      results,
      enriched_count: enrichedCount,
      credits_used: enrichedCount,
      credits_remaining: creditCheck.remaining - enrichedCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ Apollo enrich error:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
