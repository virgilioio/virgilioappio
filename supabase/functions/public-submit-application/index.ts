import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  resume?: File;
  // Custom fields from application_fields table
  custom_fields?: Record<string, any>;
  uploadedFiles?: Record<string, {
    name: string;
    type: string;
    size: number;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Get job from posting
    const { data: posting, error: postingErr } = await supabase
      .from("job_postings")
      .select("id, job_id, is_active, job:jobs(organization_id)")
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

    // Check application limits first
    console.log('🔍 Checking application limits for:', candidateEmail);
    const { data: limits, error: limitErr } = await supabase.rpc('check_application_limits', {
      candidate_email_param: candidateEmail,
      job_id_param: posting.job_id,
      organization_id_param: posting.job.organization_id
    });

    if (limitErr) {
      console.error('❌ Error checking application limits:', limitErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to check application limits',
          details: limitErr.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!limits.can_apply) {
      console.log('🚫 Application blocked by limits:', limits.violations);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Application limit exceeded',
          violations: limits.violations,
          message: limits.violations[0]?.message || 'You have exceeded application limits for this organization'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    const candidateName = body.candidate_name?.trim()?.slice(0, 200) || "Applicant";
    console.log("📝 Candidate name:", candidateName);

    // Find or create global candidate record - email-only matching
    let globalCandidateId: string | null = null;

    console.log('📧 Looking for existing candidate by email:', candidateEmail);
    const { data: existingCandidate, error: lookupErr } = await supabase
      .from("candidates")
      .select("id, candidate_name, email")
      .eq("email", candidateEmail)
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
      };

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
        console.error("Error inserting global candidate:", globalInsertErr);
        return new Response(JSON.stringify({ error: "Failed to create global candidate" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      globalCandidateId = newGlobalCandidate.id;
    }

    // No longer creating job-specific candidate records
    // All candidate data is now stored in the global candidates table only

    // Create association in Application Review (NULL stage) using the GLOBAL candidate id
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
      return new Response(JSON.stringify({ error: "Failed to place candidate in Application Review" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track application in limits system
    console.log('📊 Recording application for limits tracking');
    const { error: limitsTrackErr } = await supabase
      .from('candidate_application_limits')
      .insert({
        candidate_email: candidateEmail,
        job_id: posting.job_id,
        posting_id: postingId,
        organization_id: posting.job.organization_id,
        status: 'active'
      });

    if (limitsTrackErr) {
      console.error('⚠️ Warning: Failed to track application limits:', limitsTrackErr);
      // Don't fail the application for this, just log the warning
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
    if (body.uploadedFiles && Object.keys(body.uploadedFiles).length > 0) {
      console.log("Processing uploaded files...");
      
      // Validate files before processing
      for (const [fieldId, fileData] of Object.entries(body.uploadedFiles)) {
        if (!fileData || !fileData.data) {
          fileUploadResults.push({
            fieldId,
            fileName: fileData?.name || 'unknown',
            success: false,
            error: 'No file data provided'
          });
          continue;
        }

        // File size validation (15MB limit)
        if (fileData.size > 15 * 1024 * 1024) {
          fileUploadResults.push({
            fieldId,
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
            fieldId,
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

          // Verify buffer size matches expected file size (within reasonable margin)
          if (Math.abs(buffer.length - fileData.size) > fileData.size * 0.1) {
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
              fieldId,
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
              file_size_bytes: fileData.size,
              file_type: fileData.type,
              is_resume: /resume|cv|curriculum/i.test(fileData.name) || 
                         ['pdf', 'doc', 'docx'].includes(fileExt) || 
                         Object.keys(body.uploadedFiles || {}).length === 1,
              uploaded_by: null,
            });

          if (dbError) {
            console.error("Database file insert error:", dbError);
            // Clean up storage if database insert fails
            await supabase.storage
              .from('candidate-attachments')
              .remove([fileName]);
            
            fileUploadResults.push({
              fieldId,
              fileName: fileData.name,
              success: false,
              error: `Database error: ${dbError.message}`
            });
          } else {
            console.log("✅ File uploaded successfully:", fileName);
            fileUploadResults.push({
              fieldId,
              fileName: fileData.name,
              success: true
            });
          }
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          fileUploadResults.push({
            fieldId,
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

    // Check if any required file uploads failed
    const failedUploads = fileUploadResults.filter(result => !result.success);
    const hasFailedUploads = failedUploads.length > 0;

    const response: SubmitApplicationResponse = {
      success: true,
      candidateId: globalCandidateId,
      globalCandidateId,
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
