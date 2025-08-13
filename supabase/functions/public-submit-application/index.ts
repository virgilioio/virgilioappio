import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitApplicationPayload {
  postingId: string;
  jobId: string;
  fields: {
    candidate_name?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    linkedin_url?: string;
    profile_summary?: string; // HTML allowed (will be stored as text)
  };
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
    console.log("📥 Received public application:", JSON.stringify(body)?.slice(0, 400));

    if (!body?.postingId || !body?.jobId) {
      return new Response(JSON.stringify({ error: "Missing postingId or jobId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate posting and ensure it belongs to the job and is active
    const { data: posting, error: postingErr } = await supabase
      .from("job_postings")
      .select("id, job_id, is_active")
      .eq("id", body.postingId)
      .maybeSingle();

    if (postingErr) {
      console.error("Error verifying posting:", postingErr);
      return new Response(JSON.stringify({ error: "Failed to verify posting" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!posting || posting.job_id !== body.jobId || posting.is_active === false) {
      return new Response(JSON.stringify({ error: "Invalid or inactive posting" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const f = body.fields || {};
    const candidateName = (f.candidate_name || f.full_name || `${f.first_name ?? ""} ${f.last_name ?? ""}`)
      .trim()
      .slice(0, 200) || "Applicant";

    // Find or create global candidate record
    let globalCandidateId: string | null = null;

    // Try to find by LinkedIn first, then by email
    if (f.linkedin_url) {
      const { data: existingByLinkedIn } = await supabase
        .from("candidates")
        .select("id, candidate_name")
        .eq("linkedin_url", f.linkedin_url)
        .maybeSingle();
      if (existingByLinkedIn) {
        globalCandidateId = existingByLinkedIn.id;
      }
    }

    if (!globalCandidateId && f.email) {
      const { data: existingByEmail } = await supabase
        .from("candidates")
        .select("id, candidate_name")
        .eq("email", f.email)
        .maybeSingle();
      if (existingByEmail) {
        globalCandidateId = existingByEmail.id;
      }
    }

    // If not found, create a new global candidate
    if (!globalCandidateId) {
      const candidateData: any = {
        candidate_name: candidateName,
        email: f.email?.slice(0, 320) || null,
        phone: f.phone?.slice(0, 80) || null,
        linkedin_url: f.linkedin_url?.slice(0, 512) || null,
        profile_summary: f.profile_summary || null,
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

    // Insert job-specific candidate record (used for per-job views and data)
    const jobCandidateData: any = {
      job_id: body.jobId,
      candidate_name: candidateName,
      linkedin_url: f.linkedin_url?.slice(0, 512) || null,
      profile_summary: f.profile_summary || null,
    };

    // Include generated skills for job candidate too
    if (body.generatedSkills && body.generatedSkills.length > 0) {
      jobCandidateData.skills = body.generatedSkills.map(skill => skill.name);
      jobCandidateData.auto_generated_skills = body.generatedSkills;
      jobCandidateData.skills_metadata = body.generatedSkills;
      jobCandidateData.last_skills_generation = new Date().toISOString();
    }

    const { data: jobCandidate, error: insertJobCandidateErr } = await supabase
      .from("job_candidates")
      .insert(jobCandidateData)
      .select("id, candidate_name")
      .single();

    if (insertJobCandidateErr || !jobCandidate) {
      console.error("Error inserting job_candidate:", insertJobCandidateErr);
      return new Response(JSON.stringify({ error: "Failed to create job candidate" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create association in Application Review (NULL stage) using the GLOBAL candidate id
    const { error: assocErr } = await supabase
      .from("job_candidate_associations")
      .insert({
        job_id: body.jobId,
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

    // Handle file uploads if any
    if (body.uploadedFiles && Object.keys(body.uploadedFiles).length > 0) {
      console.log("Processing uploaded files...");
      
      for (const [fieldId, fileData] of Object.entries(body.uploadedFiles)) {
        if (!fileData || !fileData.data) continue;
        
        try {
          // Convert base64 to buffer
          const base64Data = fileData.data.split(',')[1] || fileData.data;
          const buffer = new Uint8Array(
            atob(base64Data)
              .split('')
              .map(c => c.charCodeAt(0))
          );

          // Generate unique filename
          const fileExt = fileData.name.split('.').pop() || 'pdf';
          const fileName = `${jobCandidate.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

          console.log("Uploading file:", fileName, "Size:", buffer.length);

          // Upload to storage
          const { error: storageError } = await supabase.storage
            .from('candidate-attachments')
            .upload(fileName, buffer, {
              contentType: fileData.type,
            });

          if (storageError) {
            console.error("Storage upload error:", storageError);
            continue; // Skip this file but don't fail the entire submission
          }

          // Store file metadata in database
          const { error: dbError } = await supabase
            .from('candidate_attachments')
            .insert({
              candidate_id: globalCandidateId, // Associate with global candidate
              file_name: fileData.name,
              file_url: fileName,
              file_size_bytes: fileData.size,
              file_type: fileData.type,
              is_resume: /resume/i.test(fileData.name) || fileExt === 'pdf',
              uploaded_by: null, // Public submission
            });

          if (dbError) {
            console.error("Database file insert error:", dbError);
            // Clean up storage if database insert fails
            await supabase.storage
              .from('candidate-attachments')
              .remove([fileName]);
          } else {
            console.log("✅ File uploaded successfully:", fileName);
          }
        } catch (fileError) {
          console.error("Error processing file:", fileError);
          continue; // Skip this file but don't fail the entire submission
        }
      }
    }

    console.log("✅ Public application processed for", candidateName, {
      globalCandidateId,
      jobCandidateId: jobCandidate.id,
    });

    return new Response(
      JSON.stringify({ success: true, jobCandidateId: jobCandidate.id, globalCandidateId }),
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
