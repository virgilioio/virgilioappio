import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const CORESIGNAL_API_KEY = Deno.env.get('CORESIGNAL_API_KEY');
const CORESIGNAL_COLLECT_URL = 'https://api.coresignal.com/cdapi/v2/employee_base/collect';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface CollectRequest {
  coresignal_id: string;
  project_id?: string;
  job_id?: string;
  organization_id?: string;
  user_id?: string;
}

// Helper to get current billing cycle for tenant
async function getCurrentBillingCycle(tenantId: string): Promise<Date> {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('current_period_start, billing_interval, trial_started_at, billing_status')
    .eq('tenant_id', tenantId)
    .single();
  
  if (error || !data) {
    throw new Error('Subscription not found');
  }
  
  // If in trial, use trial_started_at
  if (data.billing_status === 'trialing' && data.trial_started_at) {
    return new Date(data.trial_started_at);
  }
  
  // Otherwise use current_period_start
  if (data.current_period_start) {
    return new Date(data.current_period_start);
  }
  
  // Fallback to current month start
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Updated checkCreditAvailability
async function checkCreditAvailability(
  tenantId: string,
  type: 'search' | 'collect'
): Promise<{
  available: boolean;
  remaining: number;
  usage: any;
  currentTier: string;
  requiresUpgrade: boolean;
  nextReset: string;
}> {
  const billingCycleStart = await getCurrentBillingCycle(tenantId);
  
  // Get subscription tier
  const { data: subscription } = await supabase
    .from('tenant_subscriptions')
    .select('subscription_tier, billing_status, billing_interval')
    .eq('tenant_id', tenantId)
    .single();
  
  const currentTier = subscription?.subscription_tier || 'launch';
  
  // Get or create usage record for current billing cycle
  let { data: usage, error } = await supabase
    .from('coresignal_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('billing_cycle_start', billingCycleStart.toISOString())
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Create new usage record (limits auto-set by trigger)
    const { data: newUsage, error: insertError } = await supabase
      .from('coresignal_usage')
      .insert({
        tenant_id: tenantId,
        billing_cycle_start: billingCycleStart.toISOString()
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    usage = newUsage;
  } else if (error) {
    throw error;
  }
  
  // Calculate next reset date
  const nextReset = new Date(billingCycleStart);
  const interval = subscription?.billing_interval === 'year' ? 12 : 1;
  nextReset.setMonth(nextReset.getMonth() + interval);
  
  const creditsUsed = type === 'search' ? usage.search_credits_used : usage.collect_credits_used;
  const creditsLimit = type === 'search' ? usage.search_credits_limit : usage.collect_credits_limit;
  const remaining = Math.max(0, creditsLimit - creditsUsed);
  
  return {
    available: remaining > 0,
    remaining,
    usage,
    currentTier,
    requiresUpgrade: remaining === 0 && currentTier !== 'business', // business is top tier
    nextReset: nextReset.toISOString()
  };
}

// Updated incrementCreditUsage
async function incrementCreditUsage(
  tenantId: string,
  type: 'search' | 'collect'
): Promise<void> {
  const billingCycleStart = await getCurrentBillingCycle(tenantId);
  
  // Use PostgreSQL RPC for atomic increment
  await supabase.rpc('increment_coresignal_usage', {
    p_tenant_id: tenantId,
    p_billing_cycle_start: billingCycleStart.toISOString(),
    p_credit_type: type
  });
}

// Generate profile summary from CoreSignal data using OpenAI
async function generateProfileSummaryFromCoreSignal(profile: any): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OpenAI API key not configured, using headline as fallback');
    return profile.headline || profile.summary || 'Professional profile';
  }

  const systemPrompt = `You are an expert ATS resume parser creating professional profiles.
Generate a comprehensive, detailed professional profile in Spanish (200-300 words).
Use rich markdown formatting: **bold** for headings/key skills, *italic* for emphasis, bullet lists for achievements.

Structure:
**[Full Name]**

*Professional headline (key expertise areas separated by vertical bars)*

**Ubicación:** [Location if available]

---

**RESUMEN PROFESIONAL**
2-3 paragraphs covering career overview, expertise, achievements, unique value (150-200 words)

---

**EXPERIENCIA PROFESIONAL**
Most recent/relevant positions (2-3):
**Company** — *Title* | Dates
- Key achievements with quantifiable results
- Major responsibilities

---

**EDUCACIÓN**
Institution, Degree, Years

---

**COMPETENCIAS CLAVE**
- Technical skills
- Domain expertise  
- Soft skills

Return ONLY the formatted profile content, no commentary.`;

  const userPrompt = `Generate a professional profile summary from this LinkedIn data:

Name: ${profile.full_name || 'Professional'}
Headline: ${profile.headline || profile.summary || 'N/A'}
Location: ${profile.location_city ? `${profile.location_city}, ${profile.location_country || ''}` : 'N/A'}
Connections: ${profile.connections_count || 'N/A'}

**Work Experience:**
${profile.experience?.slice(0, 5).map((exp: any) => `
- ${exp.title || 'Unknown'} at ${exp.company || 'Unknown'} (${exp.start_date || '?'} - ${exp.end_date || exp.is_current ? 'Present' : '?'})
  ${exp.description || 'No description'}`).join('\n') || 'None listed'}

**Education:**
${profile.education?.slice(0, 3).map((edu: any) => `
- ${edu.degree || 'Degree'} in ${edu.field_of_study || 'N/A'} from ${edu.institution || 'Unknown'} (${edu.start_date || '?'} - ${edu.end_date || '?'})`).join('\n') || 'None listed'}

**Skills:** ${profile.skills?.map((s: any) => s.name || s).join(', ') || 'None listed'}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      return profile.headline || profile.summary || 'Professional profile';
    }

    const data = await response.json();
    const generatedSummary = data.choices?.[0]?.message?.content?.trim();
    
    if (!generatedSummary) {
      console.warn('⚠️ No summary generated, using fallback');
      return profile.headline || profile.summary || 'Professional profile';
    }

    return generatedSummary;
  } catch (error) {
    console.error('❌ Error generating profile summary:', error);
    return profile.headline || profile.summary || 'Professional profile';
  }
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { coresignal_id, project_id, job_id, organization_id, user_id }: CollectRequest = await req.json();

    console.log('📥 CoreSignal Collect Request:', { coresignal_id, project_id, job_id, user_id });

    // Determine tenant ID
    let tenantId: string | null = null;
    let orgId: string | null = null;

    if (project_id) {
      const { data: project, error: projectError } = await supabase
        .from('sourcing_projects')
        .select('organization_id')
        .eq('id', project_id)
        .single();
      
      if (projectError) throw new Error('Project not found');
      orgId = project.organization_id;
      
      // Resolve tenant from organization
      const { data: org } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', orgId)
        .single();
      
      tenantId = org?.tenant_id;
    } else if (job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('tenant_id, organization_id')
        .eq('id', job_id)
        .single();
      
      if (jobError) throw new Error('Job not found');
      tenantId = job.tenant_id;
      orgId = job.organization_id;
    } else if (organization_id) {
      orgId = organization_id;
      // Resolve tenant from provided org
      const { data: org } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', orgId)
        .single();
      
      tenantId = org?.tenant_id;
    } else if (user_id) {
      // Find user's organization from their profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user_id)
        .single();
      
      if (profile?.organization_id) {
        orgId = profile.organization_id;
        
        // Resolve tenant from user's organization
        const { data: org } = await supabase
          .from('organizations')
          .select('tenant_id')
          .eq('id', orgId)
          .single();
        
        tenantId = org?.tenant_id;
      }
    }

    if (!tenantId) {
      throw new Error('Tenant ID could not be determined');
    }
    
    if (!orgId) {
      throw new Error('Organization ID required');
    }

    // Check if profile already collected
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('coresignal_profile_id', coresignal_id)
      .eq('organization_id', orgId)
      .single();
    
    if (existing) {
      console.log('✅ Profile already collected:', existing.id);
      
      // Create association if job_id provided
      if (job_id) {
        await supabase
          .from('job_candidate_associations')
          .insert({
            job_id,
            candidate_id: existing.id
          })
          .onConflict('job_id,candidate_id')
          .ignore();
      }
      
      return new Response(JSON.stringify({
        candidate_id: existing.id,
        collect_credit_used: false,
        credits_remaining: 0,
        already_collected: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Check collect credit availability BEFORE making API call (using tenantId)
    const creditCheck = await checkCreditAvailability(tenantId, 'collect');
    
    if (!creditCheck.available) {
      console.warn('❌ Monthly collect credit limit reached');
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0,
        credits_limit: creditCheck.usage.collect_credits_limit,
        credits_used: creditCheck.usage.collect_credits_used,
        next_reset: creditCheck.nextReset
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    console.log(`💳 Credits available: ${creditCheck.remaining} collect credits remaining`);

    console.log('📡 Calling CoreSignal Collect API for ID:', coresignal_id);

    // Call CoreSignal Collect API
    const coresignalResponse = await fetch(`${CORESIGNAL_COLLECT_URL}/${coresignal_id}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apikey': CORESIGNAL_API_KEY,
      },
    });

    if (!coresignalResponse.ok) {
      const errorText = await coresignalResponse.text();
      console.error('CoreSignal Collect API error:', errorText);
      throw new Error(`CoreSignal Collect API error: ${coresignalResponse.status}`);
    }

    const profile = await coresignalResponse.json();
    
    console.log('✅ CoreSignal profile collected:', profile.full_name);

    // Extract basic candidate data for immediate insertion
    const basicCandidateData: any = {
      organization_id: orgId,
      created_by: user_id || null,
      candidate_name: profile.full_name || 'Unknown',
      email: profile.emails?.[0] || null,
      phone: profile.phones?.[0] || null,
      linkedin_url: profile.profile_url || profile.linkedin_url || null,
      location_city: profile.location_city || null,
      location_country: profile.location_country || profile.country || null,
      location_state: profile.location_state || null,
      
      // Raw data without AI processing
      skills: profile.skills?.map((s: any) => s.name || s) || [],
      source: 'coresignal',
      coresignal_profile_id: coresignal_id,
      coresignal_search_score: profile._score || 0,
      coresignal_collected_at: new Date().toISOString(),
      coresignal_headline: profile.headline || null,
      coresignal_connections_count: profile.connections_count || null,
      years_experience: profile.experience?.length || null,
      
      company_current: profile.experience?.find((exp: any) => exp.is_current)?.company || null,
      role_current: profile.experience?.find((exp: any) => exp.is_current)?.title || null,
      
      // Mark as processing
      profile_summary: null,
      auto_generated_skills: null,
      last_skills_generation: null
    };

    // Insert basic candidate data immediately
    console.log('💾 Inserting basic candidate data...');
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert(basicCandidateData)
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Candidate insert error:', insertError);
      throw insertError;
    }

    const candidateId = candidate.id;
    console.log('✅ Basic candidate created:', candidateId);

    // Insert work experience
    if (profile.experience && profile.experience.length > 0) {
      const experienceData = profile.experience.map((exp: any) => ({
        candidate_id: candidateId,
        company_name: exp.company || 'Unknown',
        job_title: exp.title || 'Unknown',
        start_date: exp.start_date || null,
        end_date: exp.end_date || null,
        is_current: exp.is_current || false,
        description: exp.description || null,
        location: exp.location || null
      }));

      await supabase.from('candidate_work_experience').insert(experienceData);
    }

    // Insert education
    if (profile.education && profile.education.length > 0) {
      const educationData = profile.education.map((edu: any) => ({
        candidate_id: candidateId,
        institution_name: edu.institution || 'Unknown',
        degree_type: edu.degree || null,
        field_of_study: edu.field_of_study || null,
        start_date: edu.start_date || null,
        end_date: edu.end_date || null,
        description: edu.description || null
      }));

      await supabase.from('candidate_education').insert(educationData);
    }

    // Create job association if job_id provided
    if (job_id) {
      await supabase
        .from('job_candidate_associations')
        .insert({
          job_id,
          candidate_id: candidateId,
          added_by: user_id || null
        })
        .onConflict('job_id,candidate_id')
        .ignore();
    }

    // Increment credit usage (async, but we await to ensure it completes)
    await incrementCreditUsage(tenantId, 'collect');
    
    // Get updated credits
    const updatedCredit = await checkCreditAvailability(tenantId, 'collect');

    // Process AI in background - don't block response
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          console.log('🤖 [Background] Generating profile summary from CoreSignal data...');
          const profileSummary = await generateProfileSummaryFromCoreSignal(profile);
          console.log('✅ [Background] Profile summary generated');

          console.log('🤖 [Background] Processing skills with AI...');
          const skillsPayload = {
            profileSummary: profileSummary,
            candidateName: profile.full_name || 'Unknown',
            context: 'candidate',
            desiredCount: 25,
            minCount: 15
          };

          const { data: skillsData, error: skillsError } = await supabase.functions.invoke(
            'generate-comprehensive-skills',
            { body: skillsPayload }
          );

          let autoGeneratedSkills = null;
          let roleLevel = null;
          let yearsExperience = profile.experience?.length || null;

          if (!skillsError && skillsData) {
            autoGeneratedSkills = skillsData.skills || null;
            roleLevel = skillsData.role_level || skillsData.roleLevel || null;
            console.log(`✅ [Background] Generated ${skillsData.skills?.length || 0} structured skills`);
            
            if (roleLevel?.level) {
              const level = roleLevel.level.toLowerCase();
              if (level.includes('senior')) yearsExperience = 8;
              else if (level.includes('lead')) yearsExperience = 6;
              else if (level.includes('manager')) yearsExperience = 5;
              else if (level.includes('director')) yearsExperience = 10;
              else if (level.includes('vp') || level.includes('c-level') || level.includes('executive')) yearsExperience = 15;
            }
          } else {
            console.error('⚠️ [Background] Skills generation failed:', skillsError);
          }

          // Update candidate with AI-generated data
          console.log('💾 [Background] Updating candidate with AI data...');
          await supabase
            .from('candidates')
            .update({
              profile_summary: profileSummary,
              auto_generated_skills: autoGeneratedSkills,
              years_experience: yearsExperience,
              last_skills_generation: new Date().toISOString()
            })
            .eq('id', candidateId);

          console.log('✅ [Background] AI processing complete for candidate:', candidateId);
        } catch (bgError) {
          console.error('❌ [Background] AI processing failed:', bgError);
          // Don't throw - this is background processing
        }
      })()
    );

    // Return immediate response
    return new Response(JSON.stringify({
      candidate_id: candidateId,
      collect_credit_used: true,
      credits_remaining: updatedCredit.remaining,
      processing_status: 'ai_processing_in_background',
      message: 'Candidate created successfully. AI summary and skills are being processed in the background.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ Error in collect-coresignal-profile function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to collect CoreSignal profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
