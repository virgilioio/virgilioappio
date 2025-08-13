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

    // Insert job-specific candidate record
    const { data: candidate, error: insertCandidateErr } = await supabase
      .from("job_candidates")
      .insert({
        job_id: body.jobId,
        candidate_name: candidateName,
        email: f.email?.slice(0, 320) || null,
        phone: f.phone?.slice(0, 80) || null,
        linkedin_url: f.linkedin_url?.slice(0, 512) || null,
        profile_summary: f.profile_summary || null,
        source: "public_posting",
      })
      .select("id, candidate_name")
      .single();

    if (insertCandidateErr || !candidate) {
      console.error("Error inserting job_candidate:", insertCandidateErr);
      return new Response(JSON.stringify({ error: "Failed to create candidate" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create association in Application Review (NULL stage)
    const { error: assocErr } = await supabase
      .from("job_candidate_associations")
      .insert({
        job_id: body.jobId,
        candidate_id: candidate.id,
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

    console.log("✅ Public application processed for", candidate.candidate_name, candidate.id);

    return new Response(
      JSON.stringify({ success: true, candidateId: candidate.id }),
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
