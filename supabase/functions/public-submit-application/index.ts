import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

interface SubmitApplicationPayload {
  postingId?: string;
  posting_id?: string;
  // Core fields - always handled the same way
  candidate_name: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  skills?: string;
  profile_summary?: string;
  resumeText?: string;
  resume?: File;
  // Custom fields from application_fields table
  custom_fields?: Record<string, any>;
  fields?: Record<string, any>;
  salary_sync?: { amount: number; currency: string; period: string } | null;
  location_sync?: { city?: string; state?: string; country?: string } | null;
  linkedin_sync?: string | null;
  uploadedFiles?: Record<string, {
    name: string;
    type: string;
    size?: number;
    data: string; // base64 encoded file data
  }> | Array<{
    name: string;
    type: string;
    size?: number;
    data: string; // base64 encoded file data
  }>;
  generatedSkills?: Array<{
    name: string;
    canonical?: string;
    category: string;
    confidence: number;
    source?: string;
  }>;
}

interface FileUploadResult {
  fieldId: string;
  fileName: string;
  success: boolean;
  error?: string;
}

interface SubmitApplicationResponse {
  success: boolean;
  candidateId?: string;
  globalCandidateId?: string;
  fileUploadResults?: FileUploadResult[];
  error?: string;
}

function parseLocationString(location: string): { city?: string; state?: string; country?: string } {
  if (!location) return {};
  
  const parts = location.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length === 1) {
    return { country: parts[0] };
  } else if (parts.length === 2) {
    return { city: parts[0], country: parts[1] };
  } else if (parts.length >= 3) {
    return {
      city: parts[parts.length - 3],
      state: parts[parts.length - 2],
      country: parts[parts.length - 1]
    };
  }
  
  return {};
}

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as SubmitApplicationPayload;
    console.log("📥 Received public application:", JSON.stringify(body, null, 2)?.slice(0, 1000));
    console.log("🔍 Fields received:", body.fields);

    const postingId = body.postingId || body.posting_id;
    if (!postingId) {
      return new Response(JSON.stringify({ error: "Missing postingId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job from posting (include tenant_id for proper isolation)
    const { data: posting, error: postingErr } = await supabase
      .from("job_postings")
      .select("id, job_id, is_active, tenant_id, job:jobs(organization_id, title)")
      .eq("id", postingId)
      .maybeSingle();

    if (postingErr || !posting) {
      console.error("Error verifying posting:", postingErr);
      return new Response(JSON.stringify({ error: "Failed to verify posting" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (posting.is_active === false) {
      return new Response(JSON.stringify({ error: "Posting is no longer active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get candidate email for application limits check
    const candidateEmail = body.email?.trim()?.slice(0, 320);
    if (!candidateEmail) {
      return new Response(JSON.stringify({ error: "Email is required for application" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate candidate name is provided
    if (!body.candidate_name?.trim()) {
      return new Response(JSON.stringify({ error: "Full name is required for application" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate resume upload is provided — handle both array and object formats
    const uploadedFilesCount = !body.uploadedFiles
      ? 0
      : Array.isArray(body.uploadedFiles)
        ? body.uploadedFiles.length
        : Object.keys(body.uploadedFiles).length;

    if (uploadedFilesCount === 0) {
      return new Response(JSON.stringify({ error: "Resume/CV is required for application" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required custom fields
    const { data: requiredFields, error: fieldsErr } = await supabase
      .from('job_posting_application_fields')
      .select('field_name, field_label, is_required')
      .eq('posting_id', postingId)
      .eq('is_required', true);

    if (!fieldsErr && requiredFields) {
      const missingFields: string[] = [];
      for (const field of requiredFields) {
        const fieldValue = body.custom_fields?.[field.field_name];
        if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
          missingFields.push(field.field_label);
        }
      }
      
      if (missingFields.length > 0) {
        return new Response(JSON.stringify({ 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check application limits first
    console.log('🔍 Checking application limits for:', candidateEmail);
    const { data: limits, error: limitErr } = await supabase.rpc('check_application_limits', {
      candidate_email_param: candidateEmail,
      job_id_param: posting.job_id,
      organization_id_param: (posting as any).job.organization_id,
      tenant_id_param: posting.tenant_id
    });

    if (limitErr) {
      // ⚠️ Non-blocking: log the error but don't stop the applicant
      // Spam protection is a nice-to-have; blocking legitimate applicants is not acceptable
      console.error('⚠️ Warning: Application limits check failed (non-blocking):', limitErr);
    }

    if (limits && !limits.can_apply) {
      console.log('🚫 Application blocked by limits:', limits.violations);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Application limit exceeded',
          violations: limits.violations,
          message: limits.violations[0]?.message || 'You have exceeded application limits for this organization'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const candidateName = body.candidate_name?.trim()?.slice(0, 200) || "Applicant";
    console.log("📝 Candidate name:", candidateName);

    // Find or create global candidate record - email-only matching WITHIN TENANT
    let globalCandidateId: string | null = null;
    const postingTenantId = posting.tenant_id;

    console.log('📧 Looking for existing candidate by email+name within tenant:', candidateEmail, 'tenant:', postingTenantId);
    const { data: existingCandidate, error: lookupErr } = await supabase
      .from("candidates")
      .select("id, candidate_name, email")
      .eq("email", candidateEmail)
      .eq("candidate_name", candidateName)  // Match exact unique constraint (email, candidate_name)
      .eq("tenant_id", postingTenantId)  // CRITICAL: Filter by tenant_id
      .maybeSingle();

    if (lookupErr) {
      console.error('❌ Error looking up existing candidate:', lookupErr);
    } else if (existingCandidate) {
      globalCandidateId = existingCandidate.id;
      console.log(`🎯 Found existing candidate: ${existingCandidate.candidate_name} (${existingCandidate.email})`);
    } else {
      console.log('👤 No existing candidate found, will create new one');
    }

    // If not found, create a new global candidate
    if (!globalCandidateId) {
        const candidateData: any = {
          candidate_name: candidateName,
          email: candidateEmail,
          phone: body.phone?.slice(0, 80) || null,
          linkedin_url: body.linkedin_url?.slice(0, 512) || null,
          profile_summary: body.profile_summary || null,
          skills: body.skills ? [body.skills] : null,
          source: "public_posting",
          tenant_id: postingTenantId,  // CRITICAL: Set tenant_id for proper isolation
          organization_id: (posting as any).job?.organization_id || null,  // Set org_id so activity feed works for inbound applicants
        };

        // Parse location if provided
        if (body.location) {
          const locationParts = parseLocationString(body.location);
          if (locationParts.city) candidateData.location_city = locationParts.city;
          if (locationParts.state) candidateData.location_state = locationParts.state;
          if (locationParts.country) candidateData.location_country = locationParts.country;
        }

      // Include generated skills if provided
      if (body.generatedSkills && body.generatedSkills.length > 0) {
        candidateData.skills = body.generatedSkills.map(skill => skill.name);
        candidateData.auto_generated_skills = body.generatedSkills;
        candidateData.skills_metadata = body.generatedSkills;
        candidateData.last_skills_generation = new Date().toISOString();
      }

      const { data: newGlobalCandidate, error: globalInsertErr } = await supabase
        .from("candidates")
        .insert(candidateData)
        .select("id, candidate_name")
        .single();

      if (globalInsertErr || !newGlobalCandidate) {
        if (globalInsertErr?.code === '23505') {
          // Duplicate key — fetch the existing record and continue gracefully
          console.warn('⚠️ Duplicate candidate on insert (23505), fetching existing record...');
          const { data: dupeCandidate } = await supabase
            .from("candidates")
            .select("id")
            .eq("email", candidateEmail)
            .eq("candidate_name", candidateName)
            .eq("tenant_id", postingTenantId)
            .maybeSingle();
          if (dupeCandidate) {
            globalCandidateId = dupeCandidate.id;
            console.log('✅ Recovered duplicate candidate:', globalCandidateId);
          } else {
            // Fallback: lookup by email + tenant only
            const { data: fallback } = await supabase
              .from("candidates")
              .select("id")
              .eq("email", candidateEmail)
              .eq("tenant_id", postingTenantId)
              .maybeSingle();
            if (fallback) {
              globalCandidateId = fallback.id;
              console.log('✅ Recovered via fallback lookup:', globalCandidateId);
            }
          }
          if (!globalCandidateId) {
            console.error("Could not recover existing candidate after 23505");
            return new Response(JSON.stringify({ error: "Failed to create global candidate" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // else: fall through with recovered candidate ID ✅
        } else {
          console.error("Error inserting global candidate:", globalInsertErr);
          return new Response(JSON.stringify({ error: "Failed to create global candidate" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        globalCandidateId = newGlobalCandidate.id;
      }
    }

    // Sync salary data to candidate profile if salary field was submitted
    if (body.salary_sync && body.salary_sync.amount && globalCandidateId) {
      console.log('💰 Syncing salary data to candidate profile:', body.salary_sync);
      const { error: salaryErr } = await supabase
        .from('candidates')
        .update({
          salary_amount: body.salary_sync.amount,
          salary_currency: body.salary_sync.currency,
          salary_period: body.salary_sync.period,
        })
        .eq('id', globalCandidateId);
      if (salaryErr) {
        console.error('⚠️ Warning: Failed to sync salary data:', salaryErr);
      }
    }

    // Sync location data to candidate profile if location field was submitted
    if (body.location_sync && globalCandidateId) {
      console.log('📍 Syncing location data to candidate profile:', body.location_sync);
      const locationUpdate: Record<string, string | null> = {};
      if (body.location_sync.city !== undefined) locationUpdate.location_city = body.location_sync.city || null;
      if (body.location_sync.state !== undefined) locationUpdate.location_state = body.location_sync.state || null;
      if (body.location_sync.country !== undefined) locationUpdate.location_country = body.location_sync.country || null;
      
      if (Object.keys(locationUpdate).length > 0) {
        const { error: locationErr } = await supabase
          .from('candidates')
          .update(locationUpdate)
          .eq('id', globalCandidateId);
        if (locationErr) {
          console.error('⚠️ Warning: Failed to sync location data:', locationErr);
        }
      }
    }

    // No longer creating job-specific candidate records
    // All candidate data is now stored in the global candidates table only

    // Create association in Application Review (NULL stage) using the GLOBAL candidate id
    // Check for existing association first to avoid unique constraint crash
    const { data: existingAssoc } = await supabase
      .from("job_candidate_associations")
      .select("id")
      .eq("job_id", posting.job_id)
      .eq("candidate_id", globalCandidateId)
      .maybeSingle();

    if (!existingAssoc) {
      const { error: assocErr } = await supabase
        .from("job_candidate_associations")
        .insert({
          job_id: posting.job_id,
          candidate_id: globalCandidateId,
          status: "active",
          current_stage_id: null,
        });

      if (assocErr) {
        console.error("Error creating association:", assocErr);
        // Only hard-fail if it's NOT a unique violation (23505) — duplicate is acceptable
        if (!assocErr.code?.includes('23505')) {
          return new Response(JSON.stringify({ error: "Failed to place candidate in Application Review" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      console.log("ℹ️ Candidate already associated with this job, skipping duplicate association insert.");
    }

    // Track application in limits system
    console.log('📊 Recording application for limits tracking');
    const { error: limitsTrackErr } = await supabase
      .from('candidate_application_limits')
      .insert({
        candidate_email: candidateEmail,
        job_id: posting.job_id,
        posting_id: postingId,
        organization_id: (posting as any).job.organization_id,
        tenant_id: posting.tenant_id,
        status: 'active'
      });

    if (limitsTrackErr) {
      console.error('⚠️ Warning: Failed to track application limits:', limitsTrackErr);
      // Don't fail the application for this, just log the warning
    }

    // Fire-and-forget: log activity for candidate application
    try {
      const jobTitle = (posting as any).job?.title || 'Unknown position';
      await supabase.rpc('log_activity', {
        p_user_id: globalCandidateId,
        p_organization_id: (posting as any).job?.organization_id || null,
        p_tenant_id: posting.tenant_id || null,
        p_activity_type: 'candidate_added',
        p_title: 'Applied via job posting',
        p_description: `Candidate applied for ${jobTitle}`,
        p_metadata: {},
        p_entity_type: 'candidate',
        p_entity_id: globalCandidateId,
      });
      console.log('📝 Logged application activity for candidate:', globalCandidateId);
    } catch (actErr: any) {
      console.error('⚠️ Failed to log application activity:', actErr?.message);
    }

    // Store core application field responses
    console.log('💾 Storing core application field responses');
    const coreResponseRows = [];
    
    // Store core fields
    const coreFields = [
      { name: 'candidate_name', label: 'Full Name', value: body.candidate_name },
      { name: 'email', label: 'Email Address', value: body.email },
      { name: 'phone', label: 'Phone Number', value: body.phone },
      { name: 'linkedin_url', label: 'LinkedIn Profile', value: body.linkedin_url },
      { name: 'skills', label: 'Skills', value: body.skills },
      { name: 'profile_summary', label: 'Profile Summary', value: body.profile_summary }
    ];

    for (const field of coreFields) {
      if (field.value) {
        coreResponseRows.push({
          candidate_id: globalCandidateId,
          job_id: posting.job_id,
          posting_id: postingId,
          field_name: field.name,
          field_label: field.label,
          field_value: field.value,
          field_type: field.name === 'email' ? 'email' : field.name === 'linkedin_url' ? 'url' : field.name === 'profile_summary' || field.name === 'skills' ? 'textarea' : 'text'
        });
      }
    }

    // Store custom field responses
    if (body.custom_fields && Object.keys(body.custom_fields).length > 0) {
      const { data: postingFields, error: fieldsErr } = await supabase
        .from('job_posting_application_fields')
        .select('field_name, field_label, field_type')
        .eq('posting_id', postingId)
        .order('display_order');

      if (!fieldsErr && postingFields) {
        for (const field of postingFields) {
          const fieldValue = body.custom_fields[field.field_name];
          if (fieldValue !== undefined) {
            coreResponseRows.push({
              candidate_id: globalCandidateId,
              job_id: posting.job_id,
              posting_id: postingId,
              field_name: field.field_name,
              field_label: field.field_label,
              field_value: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
              field_type: field.field_type
            });
          }
        }
      }
    }

    if (coreResponseRows.length > 0) {
      const { error: responsesErr } = await supabase
        .from('candidate_application_responses')
        .insert(coreResponseRows);

      if (responsesErr) {
        console.error('⚠️ Warning: Failed to store application responses:', responsesErr);
        // Don't fail the application for this, just log the warning
      } else {
        console.log(`✅ Stored ${coreResponseRows.length} application field responses`);
      }
    }

    // Handle file uploads if any
    const fileUploadResults: FileUploadResult[] = [];
    const uploadedFiles = body.uploadedFiles;
    if (uploadedFiles) {
      console.log("Processing uploaded files...");
      
      // Normalize uploadedFiles to array format for consistent processing
      const fileEntries = Array.isArray(uploadedFiles) 
        ? uploadedFiles.map((file, index) => [index.toString(), file])
        : Object.entries(uploadedFiles);
      
      // Validate files before processing
      for (const [fieldId, fileData] of fileEntries) {
        // Type guard for file data
        const isFileObject = (data: any): data is { name: string; type: string; size?: number; data: string } => {
          return data && typeof data === 'object' && 'data' in data && 'name' in data && 'type' in data;
        };
        
        if (!isFileObject(fileData)) {
          fileUploadResults.push({
            fieldId: fieldId as string,
            fileName: 'unknown',
            success: false,
            error: 'Invalid file data provided'
          });
          continue;
        }

        if (!fileData.data) {
          fileUploadResults.push({
            fieldId: fieldId as string,
            fileName: fileData.name || 'unknown',
            success: false,
            error: 'No file data provided'
          });
          continue;
        }

        // File size validation (15MB limit) - only if size is provided
        if (fileData.size && fileData.size > 15 * 1024 * 1024) {
          fileUploadResults.push({
            fieldId: fieldId as string,
            fileName: fileData.name,
            success: false,
            error: 'File size exceeds 15MB limit'
          });
          continue;
        }

        // File type validation
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/jpeg',
          'image/png',
          'image/gif'
        ];
        
        if (!allowedTypes.includes(fileData.type)) {
          fileUploadResults.push({
            fieldId: fieldId as string,
            fileName: fileData.name,
            success: false,
            error: `Unsupported file type: ${fileData.type}`
          });
          continue;
        }
        
        try {
          // Convert base64 to buffer
          const base64Data = fileData.data.split(',')[1] || fileData.data;
          
          // Validate base64 data
          if (!base64Data) {
            throw new Error('Invalid base64 data');
          }
          
          const buffer = new Uint8Array(
            atob(base64Data)
              .split('')
              .map(c => c.charCodeAt(0))
          );

          // Verify buffer size matches expected file size (within reasonable margin) - only if size is provided
          if (fileData.size && Math.abs(buffer.length - fileData.size) > fileData.size * 0.1) {
            throw new Error('File size mismatch during conversion');
          }

          // Generate unique filename
          const fileExt = fileData.name.split('.').pop()?.toLowerCase() || 'pdf';
          const fileName = `${globalCandidateId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

          console.log("Uploading file:", fileName, "Size:", buffer.length);

          // Upload to storage with retry logic
          let storageError = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            const { error } = await supabase.storage
              .from('candidate-attachments')
              .upload(fileName, buffer, {
                contentType: fileData.type,
                upsert: false
              });
            
            storageError = error;
            if (!error) break;
            
            console.log(`Upload attempt ${attempt} failed for ${fileName}:`, error);
            if (attempt < 2) {
              // Wait 1 second before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          if (storageError) {
            console.error("Storage upload error after retries:", storageError);
            fileUploadResults.push({
              fieldId: fieldId as string,
              fileName: fileData.name,
              success: false,
              error: `Storage upload failed: ${storageError.message}`
            });
            continue;
          }

          // Store file metadata in database
          const { error: dbError } = await supabase
            .from('candidate_attachments')
            .insert({
              candidate_id: globalCandidateId,
              file_name: fileData.name,
              file_url: fileName,
              file_size_bytes: fileData.size || buffer.length,
              file_type: fileData.type,
              is_resume: /resume|cv|curriculum/i.test(fileData.name) || 
                         ['pdf', 'doc', 'docx'].includes(fileExt) || 
                         (Array.isArray(body.uploadedFiles) ? body.uploadedFiles.length : Object.keys(body.uploadedFiles || {}).length) === 1,
              uploaded_by: null,
            });

          if (dbError) {
            console.error("Database file insert error:", dbError);
            // Clean up storage if database insert fails
            await supabase.storage
              .from('candidate-attachments')
              .remove([fileName]);
            
            fileUploadResults.push({
              fieldId: fieldId as string,
              fileName: fileData.name,
              success: false,
              error: `Database error: ${dbError.message}`
            });
          } else {
            console.log("✅ File uploaded successfully:", fileName);
            fileUploadResults.push({
              fieldId: fieldId as string,
              fileName: fileData.name,
              success: true
            });
          }
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          fileUploadResults.push({
            fieldId: fieldId as string,
            fileName: fileData.name,
            success: false,
            error: fileError instanceof Error ? fileError.message : 'Unknown file processing error'
          });
        }
      }
    }

    console.log("✅ Public application processed for", candidateName, {
      globalCandidateId,
      fileUploadResults: fileUploadResults.length > 0 ? fileUploadResults : undefined
    });

    // Fire-and-forget background AI enrichment (skills + profile summary)
    if (globalCandidateId) {
      supabase.functions.invoke('enrich-candidate-profile', {
        body: {
          candidateId: globalCandidateId,
          resumeText: body.resumeText || '',
          candidateName: candidateName,
        }
      }).catch(err => console.error('Background enrichment call failed:', err));
      
      console.log('🧠 Triggered background enrichment for candidate:', globalCandidateId);
    }

    // Fire-and-forget: Send workspace confirmation email if automation is active
    if (globalCandidateId && candidateEmail) {
      try {
        const { data: confirmationAutomation } = await supabase
          .from('workspace_automations')
          .select('*')
          .eq('tenant_id', posting.tenant_id)
          .eq('automation_type', 'application_confirmation_email')
          .eq('is_active', true)
          .maybeSingle();

        if (confirmationAutomation && confirmationAutomation.from_email && confirmationAutomation.subject && confirmationAutomation.body) {
          const jobTitle = (posting as any).job?.title || 'the open position';
          
          // Fetch tenant (workspace/company) name for {{organization.name}}
          let tenantName = '';
          if (posting.tenant_id) {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('name')
              .eq('id', posting.tenant_id)
              .maybeSingle();
            tenantName = tenant?.name || '';
          }

          // Fetch department (job folder) name for {{department.name}}
          let deptName = '';
          if ((posting as any).job?.organization_id) {
            const { data: dept } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', (posting as any).job.organization_id)
              .maybeSingle();
            deptName = dept?.name || '';
          }

          // Parse candidate first name from full name
          const candidateFirstName = candidateName.split(' ')[0] || candidateName;

          // Resolve placeholders inline
          const resolvePlaceholders = (template: string): string => {
            return template
              .replace(/\{\{candidate\.first_name\}\}/g, candidateFirstName)
              .replace(/\{\{candidate\.name\}\}/g, candidateName)
              .replace(/\{\{candidate\.email\}\}/g, candidateEmail)
              .replace(/\{\{job\.title\}\}/g, jobTitle)
              .replace(/\{\{organization\.name\}\}/g, tenantName)
              .replace(/\{\{department\.name\}\}/g, deptName);
          };

          const resolvedSubject = resolvePlaceholders(confirmationAutomation.subject);
          const resolvedBody = resolvePlaceholders(confirmationAutomation.body);

          // Convert plain text body to basic HTML (preserve line breaks)
          const bodyHtml = resolvedBody
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

          // Call send-user-email with service role auth (fire-and-forget)
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

          fetch(`${supabaseUrl}/functions/v1/send-user-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from_email: confirmationAutomation.from_email,
              to: [candidateEmail],
              subject: resolvedSubject,
              body_html: bodyHtml,
              candidate_id: globalCandidateId,
              job_id: posting.job_id,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.text();
              console.error('❌ Confirmation email send failed:', err);
            } else {
              console.log('✅ Confirmation email sent to:', candidateEmail);
            }
          }).catch(err => console.error('❌ Confirmation email call failed:', err));

          console.log('📧 Triggered confirmation email for candidate:', candidateEmail);
        } else {
          console.log('ℹ️ No active confirmation email automation found for tenant:', posting.tenant_id);
        }
      } catch (confirmErr: any) {
        console.error('⚠️ Warning: Failed to check/send confirmation email (non-blocking):', confirmErr?.message);
      }
    }

    // Check if any required file uploads failed
    const failedUploads = fileUploadResults.filter(result => !result.success);
    const hasFailedUploads = failedUploads.length > 0;

    const response: SubmitApplicationResponse = {
      success: true,
      candidateId: globalCandidateId || undefined,
      globalCandidateId: globalCandidateId || undefined,
      fileUploadResults: fileUploadResults.length > 0 ? fileUploadResults : undefined
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unhandled error in public-submit-application:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
