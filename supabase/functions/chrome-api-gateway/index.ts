import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
const APOLLO_BULK_MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================
// SHARED AUTH HELPER
// ============================================
async function authenticateUser(req: Request, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get('Authorization');
  const rawToken = authHeader?.replace('Bearer ', '').trim();
  
  if (!authHeader || !rawToken) {
    return { error: new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(rawToken);

  if (authError || !user) {
    console.error('❌ Authentication failed:', authError);
    return { error: new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  // Get user's tenant_id from members table
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select(`
      tenant_id,
      organization_id,
      system_role,
      user_type,
      tenants!members_tenant_id_fkey (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .eq('user_status', 'active')
    .single();

  if (memberError || !member?.tenant_id) {
    console.error('❌ Member/tenant not found:', memberError);
    return { error: new Response(
      JSON.stringify({ error: 'User not associated with any tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )};
  }

  return { user, member };
}

// ============================================
// ACTION: me - Get current user info
// ============================================
async function handleMe(user: any, member: any, corsHeaders: Record<string, string>) {
  const tenant = member.tenants as { id: string; name: string } | null;

  const response = {
    user_id: user.id,
    email: user.email,
    tenant_id: member.tenant_id,
    tenant_name: tenant?.name ?? null,
    member_role: member.member_role,
    user_type: member.user_type
  };

  console.log(`✅ Chrome API /me - Success for tenant: ${member.tenant_id}`);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// ACTION: organizations - List organizations
// ============================================
async function handleOrganizations(member: any, corsHeaders: Record<string, string>) {
  const tenantId = member.tenant_id;
  console.log(`🏢 Fetching organizations for tenant: ${tenantId}`);

  const { data: organizations, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, org_kind')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('name');

  if (orgsError) {
    console.error('❌ Error fetching organizations:', orgsError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch organizations' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`✅ Found ${organizations?.length ?? 0} organizations`);

  return new Response(JSON.stringify({ organizations: organizations ?? [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// ACTION: jobs - List jobs for an organization
// ============================================
async function handleJobs(params: any, member: any, corsHeaders: Record<string, string>) {
  const { organization_id } = params;
  const tenantId = member.tenant_id;

  if (!organization_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: organization_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the organization belongs to this tenant
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, tenant_id')
    .eq('id', organization_id)
    .single();

  if (orgError || !org) {
    console.error('❌ Organization not found:', orgError);
    return new Response(
      JSON.stringify({ error: 'Organization not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (org.tenant_id !== tenantId) {
    console.error('❌ Organization belongs to different tenant');
    return new Response(
      JSON.stringify({ error: 'Access denied: organization belongs to a different tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get open jobs for this organization
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, title, location, status')
    .eq('organization_id', organization_id)
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch jobs' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`✅ Found ${jobs?.length ?? 0} open jobs`);

  return new Response(JSON.stringify({ jobs: jobs ?? [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// ACTION: stages - List stages for a job
// ============================================
async function handleStages(params: any, member: any, corsHeaders: Record<string, string>) {
  const { job_id } = params;
  const tenantId = member.tenant_id;

  if (!job_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: job_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the job belongs to this tenant
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, tenant_id, organization_id')
    .eq('id', job_id)
    .single();

  if (jobError || !job) {
    console.error('❌ Job not found:', jobError);
    return new Response(
      JSON.stringify({ error: 'Job not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (job.tenant_id !== tenantId) {
    console.error('❌ Job belongs to different tenant');
    return new Response(
      JSON.stringify({ error: 'Access denied: job belongs to a different tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get hiring stages for this job
  const { data: hiringStages, error: stagesError } = await supabase
    .from('job_hiring_stages')
    .select(`
      id,
      position,
      custom_stage_name,
      job_stages!job_hiring_stages_stage_id_fkey (
        stage_name,
        stage_type
      )
    `)
    .eq('job_id', job_id)
    .order('position');

  if (stagesError) {
    console.error('❌ Error fetching stages:', stagesError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch stages' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform the response
  const stages = (hiringStages ?? []).map(hs => {
    const jobStage = hs.job_stages as { stage_name: string; stage_type: string } | null;
    return {
      id: hs.id,
      stage_name: hs.custom_stage_name || jobStage?.stage_name || 'Unknown',
      stage_type: jobStage?.stage_type || 'unknown',
      position: hs.position
    };
  });

  console.log(`✅ Found ${stages.length} stages for job`);

  return new Response(JSON.stringify({ stages }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// ACTION: candidates - Create/attach candidate
// ============================================
interface CreateCandidateParams {
  organization_id: string;
  job_id: string;
  stage_id: string;
  candidate_name: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company_current?: string;
  role_current?: string;
  location_city?: string;
  location_country?: string;
  profile_summary?: string;
  skills?: string[];
  notes?: string;
}

async function handleCandidates(params: CreateCandidateParams, user: any, member: any, corsHeaders: Record<string, string>) {
  const tenantId = member.tenant_id;
  const userId = user.id;
  
  const {
    organization_id,
    job_id,
    stage_id,
    candidate_name,
    email,
    phone,
    linkedin_url,
    company_current,
    role_current,
    location_city,
    location_country,
    profile_summary,
    skills,
    notes
  } = params;

  // Validate required fields
  if (!organization_id || !job_id || !stage_id || !candidate_name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: organization_id, job_id, stage_id, candidate_name' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`👤 Chrome API /candidates - User: ${userId}, Creating candidate: ${candidate_name}`);

  // Verify organization belongs to tenant
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, tenant_id')
    .eq('id', organization_id)
    .single();

  if (orgError || !org) {
    return new Response(
      JSON.stringify({ error: 'Organization not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (org.tenant_id !== tenantId) {
    return new Response(
      JSON.stringify({ error: 'Access denied: organization belongs to a different tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify job belongs to tenant and organization
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, tenant_id, organization_id')
    .eq('id', job_id)
    .single();

  if (jobError || !job) {
    return new Response(
      JSON.stringify({ error: 'Job not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (job.tenant_id !== tenantId) {
    return new Response(
      JSON.stringify({ error: 'Access denied: job belongs to a different tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (job.organization_id !== organization_id) {
    return new Response(
      JSON.stringify({ error: 'Job does not belong to the specified organization' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify stage belongs to job
  const { data: stage, error: stageError } = await supabase
    .from('job_hiring_stages')
    .select('id, job_id')
    .eq('id', stage_id)
    .single();

  if (stageError || !stage) {
    return new Response(
      JSON.stringify({ error: 'Stage not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (stage.job_id !== job_id) {
    return new Response(
      JSON.stringify({ error: 'Stage does not belong to the specified job' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check for duplicate candidate
  let existingCandidate = null;
  let wasDuplicate = false;

  if (email) {
    const { data: byEmail } = await supabase
      .from('candidates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('organization_id', organization_id)
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (byEmail) {
      existingCandidate = byEmail;
      wasDuplicate = true;
      console.log(`🔍 Found duplicate by email: ${email}`);
    }
  }

  if (!existingCandidate && linkedin_url) {
    const { data: byLinkedIn } = await supabase
      .from('candidates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('organization_id', organization_id)
      .eq('linkedin_url', linkedin_url)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (byLinkedIn) {
      existingCandidate = byLinkedIn;
      wasDuplicate = true;
      console.log(`🔍 Found duplicate by LinkedIn: ${linkedin_url}`);
    }
  }

  let candidateId: string;
  let existingJobAssociations: Array<{
    association_id: string;
    job_id: string;
    job_title: string;
    stage_id: string | null;
    stage_name: string;
    candidate_url: string;
  }> | null = null;

  if (existingCandidate) {
    candidateId = existingCandidate.id;
    console.log(`📋 Using existing candidate: ${candidateId}`);

    // Fetch existing job associations
    const { data: associations } = await supabase
      .from('job_candidate_associations')
      .select(`
        id,
        status,
        current_stage_id,
        job_id,
        jobs!inner (
          id,
          title
        ),
        job_hiring_stages (
          id,
          custom_stage_name,
          job_stages (
            stage_name
          )
        )
      `)
      .eq('candidate_id', candidateId)
      .in('status', ['active', 'offer', 'hired']);

    if (associations && associations.length > 0) {
      existingJobAssociations = associations.map((assoc: any) => ({
        association_id: assoc.id,
        job_id: assoc.job_id,
        job_title: assoc.jobs?.title || 'Unknown Job',
        stage_id: assoc.current_stage_id,
        stage_name: assoc.job_hiring_stages?.custom_stage_name 
          || assoc.job_hiring_stages?.job_stages?.stage_name 
          || 'Unknown Stage',
        candidate_url: `/jobs/${assoc.job_id}/candidates/${candidateId}`
      }));
    }
  } else {
    // Create new candidate
    const { data: newCandidate, error: createError } = await supabase
      .from('candidates')
      .insert({
        candidate_name,
        email: email || null,
        phone: phone || null,
        linkedin_url: linkedin_url || null,
        company_current: company_current || null,
        role_current: role_current || null,
        location_city: location_city || null,
        location_country: location_country || null,
        profile_summary: profile_summary || null,
        skills: skills || null,
        source: 'linkedin_extension',
        organization_id,
        tenant_id: tenantId,
        created_by: userId,
        status: 'available'
      })
      .select('id')
      .single();

    if (createError || !newCandidate) {
      console.error('❌ Failed to create candidate:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create candidate' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    candidateId = newCandidate.id;
    console.log(`✨ Created new candidate: ${candidateId}`);
  }

  // Check if association already exists
  const { data: existingAssoc } = await supabase
    .from('job_candidate_associations')
    .select('id')
    .eq('job_id', job_id)
    .eq('candidate_id', candidateId)
    .maybeSingle();

  let associationId: string;
  let action: string;

  if (existingAssoc) {
    // Update existing association's stage
    const { error: updateError } = await supabase
      .from('job_candidate_associations')
      .update({
        current_stage_id: stage_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingAssoc.id);

    if (updateError) {
      console.error('❌ Failed to update association:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update job association' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    associationId = existingAssoc.id;
    action = 'updated';
    console.log(`🔄 Updated existing association: ${associationId}`);
  } else {
    // Create new association
    const { data: newAssoc, error: assocError } = await supabase
      .from('job_candidate_associations')
      .insert({
        job_id,
        candidate_id: candidateId,
        current_stage_id: stage_id,
        status: 'active',
        added_by: userId,
        notes: notes || null,
        entered_stage_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (assocError || !newAssoc) {
      console.error('❌ Failed to create association:', assocError);
      return new Response(
        JSON.stringify({ error: 'Failed to create job association' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    associationId = newAssoc.id;
    action = wasDuplicate ? 'attached' : 'created';
    console.log(`✅ Created new association: ${associationId}`);
  }

  // Build response
  const response: Record<string, any> = {
    candidate_id: candidateId,
    association_id: associationId,
    was_duplicate: wasDuplicate,
    action
  };

  if (wasDuplicate && existingJobAssociations && existingJobAssociations.length > 0) {
    response.existing_jobs = existingJobAssociations;
  }

  console.log(`✅ Chrome API /candidates - Success: ${JSON.stringify(response)}`);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// ACTION: resume - Upload resume
// ============================================
interface ResumeUploadParams {
  candidate_id: string;
  filename: string;
  file_data: string;
}

async function handleResume(params: ResumeUploadParams, user: any, member: any, corsHeaders: Record<string, string>) {
  const tenantId = member.tenant_id;
  const userId = user.id;
  
  const { candidate_id, filename, file_data } = params;

  if (!candidate_id || !filename || !file_data) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: candidate_id, filename, file_data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`📎 Chrome API /resume - User: ${userId}, Candidate: ${candidate_id}, File: ${filename}`);

  // Verify candidate exists and belongs to user's tenant
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, tenant_id')
    .eq('id', candidate_id)
    .is('deleted_at', null)
    .single();

  if (candidateError || !candidate) {
    return new Response(
      JSON.stringify({ error: 'Candidate not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (candidate.tenant_id !== tenantId) {
    return new Response(
      JSON.stringify({ error: 'Access denied: candidate belongs to a different tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Decode base64 file data
  let fileBytes: Uint8Array;
  try {
    const base64Data = file_data.includes(',') ? file_data.split(',')[1] : file_data;
    const binaryString = atob(base64Data);
    fileBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      fileBytes[i] = binaryString.charCodeAt(i);
    }
  } catch (decodeError) {
    console.error('❌ Failed to decode base64 file data:', decodeError);
    return new Response(
      JSON.stringify({ error: 'Invalid base64 file data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const fileSizeBytes = fileBytes.length;
  console.log(`📊 File size: ${fileSizeBytes} bytes`);

  // Check file size (15MB limit)
  const maxSizeBytes = 15 * 1024 * 1024;
  if (fileSizeBytes > maxSizeBytes) {
    return new Response(
      JSON.stringify({ error: 'File too large. Maximum size is 15MB.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Sanitize filename
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Generate storage path
  const randomId = crypto.randomUUID().split('-')[0];
  const timestamp = Date.now();
  const storagePath = `${candidate_id}/${timestamp}-${randomId}.pdf`;

  console.log(`📁 Uploading to: ${storagePath}`);

  // Upload to candidate-attachments bucket
  const { error: uploadError } = await supabase.storage
    .from('candidate-attachments')
    .upload(storagePath, fileBytes, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    console.error('❌ Failed to upload file:', uploadError);
    return new Response(
      JSON.stringify({ error: 'Failed to upload file to storage' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('✅ File uploaded successfully');

  // Create record in candidate_attachments table
  const { data: attachment, error: attachmentError } = await supabase
    .from('candidate_attachments')
    .insert({
      candidate_id,
      file_name: sanitizedFilename,
      file_url: storagePath,
      file_size_bytes: fileSizeBytes,
      file_type: 'application/pdf',
      uploaded_by: userId,
      is_resume: true,
      conversion_status: 'completed'
    })
    .select('id')
    .single();

  if (attachmentError || !attachment) {
    console.error('❌ Failed to create attachment record:', attachmentError);
    await supabase.storage.from('candidate-attachments').remove([storagePath]);
    return new Response(
      JSON.stringify({ error: 'Failed to create attachment record' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response = {
    success: true,
    attachment_id: attachment.id,
    file_url: storagePath
  };

  console.log(`✅ Chrome API /resume - Success: ${JSON.stringify(response)}`);

  // Fire-and-forget: extract text from PDF and trigger AI enrichment
  try {
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(fileBytes);
    // Extract text between PDF stream markers and clean up
    const streamMatches = rawText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g) || [];
    const extractedText = streamMatches
      .map(m => m.replace(/^stream\r?\n/, '').replace(/\r?\nendstream$/, ''))
      .join(' ')
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (extractedText.length > 50) {
      console.log(`📝 Extracted ${extractedText.length} chars from PDF, triggering enrichment`);
      supabase.functions.invoke('enrich-candidate-profile', {
        body: {
          candidateId: candidate_id,
          resumeText: extractedText,
          candidateName: null,
        }
      }).catch(err => console.error('Background enrichment failed:', err));
    } else {
      console.log(`📝 PDF text too short (${extractedText.length} chars), skipping enrichment`);
    }
  } catch (extractErr) {
    console.error('PDF text extraction failed (non-blocking):', extractErr);
  }

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// CREDIT HELPERS (for enrich action)
// ============================================
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
}

// ============================================
// ACTION: enrich - Enrich contact by LinkedIn URL
// ============================================
async function handleEnrich(body: any, user: any, member: any, corsHeaders: Record<string, string>) {
  const tenantId = member.tenant_id;
  const { linkedin_url } = body;

  if (!linkedin_url) {
    return new Response(
      JSON.stringify({ error: 'LinkedIn URL required to fetch contact info', error_code: 'MISSING_LINKEDIN_URL' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!APOLLO_API_KEY) {
    console.error('❌ APOLLO_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'Contact enrichment service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check credit availability
  const creditCheck = await checkCollectCredit(tenantId);
  
  if (!creditCheck.available) {
    console.warn('❌ Monthly contact reveal credit limit reached for tenant:', tenantId);
    return new Response(
      JSON.stringify({ error: 'Monthly credit limit reached', error_code: 'CREDITS_EXHAUSTED', credits_remaining: 0 }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`🔍 Enrich contact for LinkedIn URL: ${linkedin_url}, tenant: ${tenantId}`);

  // Call enrichment provider bulk_match API
  const enrichResponse = await fetch(APOLLO_BULK_MATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': APOLLO_API_KEY
    },
    body: JSON.stringify({
      details: [{ linkedin_url }],
    })
  });

  if (!enrichResponse.ok) {
    const errorText = await enrichResponse.text();
    console.error('❌ Enrichment API error:', enrichResponse.status, errorText);
    return new Response(
      JSON.stringify({ error: 'Contact enrichment service error' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const enrichData = await enrichResponse.json();
  const matches = enrichData.matches || [];
  const person = matches[0];

  if (!person) {
    console.log('ℹ️ No enrichment match found for:', linkedin_url);
    return new Response(
      JSON.stringify({ success: false, message: 'No contact info found for this profile' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Extract contact data
  const phone = person.phone_numbers?.[0]?.sanitized_number || 
                person.phone_numbers?.[0]?.raw_number || null;

  const contactPhones = (person.phone_numbers || []).map((p: any) => ({
    type: p.type || 'other',
    number: p.sanitized_number || p.raw_number || '',
    raw_number: p.raw_number || null
  })).filter((p: any) => p.number);

  const contactEmails: any[] = [];
  if (person.email) {
    contactEmails.push({ type: 'work', email: person.email, status: person.email_status || null });
  }
  if (person.personal_emails && Array.isArray(person.personal_emails)) {
    person.personal_emails.forEach((e: string) => {
      if (e && e !== person.email) {
        contactEmails.push({ type: 'personal', email: e, status: null });
      }
    });
  }

  // Increment credit usage
  await incrementCollectCredits(tenantId, 1);

  const remaining = creditCheck.remaining - 1;
  console.log(`✅ Contact enriched for ${linkedin_url}, credits remaining: ${remaining}`);

  return new Response(JSON.stringify({
    success: true,
    email: person.email || null,
    phone: phone,
    contact_phones: contactPhones,
    contact_emails: contactEmails,
    title: person.title || null,
    company: person.organization_name || null,
    credits_used: 1,
    credits_remaining: remaining
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================
// MAIN ROUTER
// ============================================
serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);

  // Handle CORS preflight
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  try {
    // Authenticate user
    const authResult = await authenticateUser(req, corsHeaders);
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, member } = authResult;

    // Parse URL and action
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // For POST requests, also check body for action
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }
    
    const effectiveAction = action || body.action;

    console.log(`🔀 Chrome API Gateway - Action: ${effectiveAction}, Method: ${req.method}`);

    // Route to appropriate handler
    switch (effectiveAction) {
      case 'me':
        if (req.method !== 'GET' && req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return handleMe(user, member, corsHeaders);

      case 'organizations':
        if (req.method !== 'GET' && req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return handleOrganizations(member, corsHeaders);

      case 'jobs':
        return handleJobs(
          { organization_id: url.searchParams.get('organization_id') || body.organization_id },
          member,
          corsHeaders
        );

      case 'stages':
        return handleStages(
          { job_id: url.searchParams.get('job_id') || body.job_id },
          member,
          corsHeaders
        );

      case 'candidates':
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed. Use POST for candidates.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return handleCandidates(body, user, member, corsHeaders);

      case 'resume':
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed. Use POST for resume upload.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return handleResume(body, user, member, corsHeaders);

      case 'enrich':
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Method not allowed. Use POST for enrich.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return handleEnrich(body, user, member, corsHeaders);

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action', 
            valid_actions: ['me', 'organizations', 'jobs', 'stages', 'candidates', 'resume', 'enrich'],
            usage: 'Pass action as query param (?action=me) or in POST body ({ action: "me" })'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('❌ Error in chrome-api-gateway:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
