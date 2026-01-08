import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DraftRequest {
  candidate_id: string;
  job_id: string;
  prompt: string;
  email_type?: string;
  sender_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { candidate_id, job_id, prompt, email_type, sender_name } = await req.json() as DraftRequest;

    if (!candidate_id || !job_id || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch candidate details
    const { data: candidate, error: candError } = await supabase
      .from("candidates")
      .select("candidate_name, email, role_current, company_current, profile_summary, skills, location_city, location_country")
      .eq("id", candidate_id)
      .single();

    if (candError) {
      console.error("Error fetching candidate:", candError);
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("title, description, skills, location")
      .eq("id", job_id)
      .single();

    if (jobError) {
      console.error("Error fetching job:", jobError);
    }

    // Fetch recent email history (last 5)
    const { data: emails, error: emailsError } = await supabase
      .from("email_logs")
      .select("subject, body_text, direction, sent_at, received_at")
      .eq("candidate_id", candidate_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (emailsError) {
      console.error("Error fetching emails:", emailsError);
    }

    // Fetch upcoming/recent bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from("scheduled_bookings")
      .select(`
        scheduled_start,
        scheduled_end,
        status,
        booking_configurations!inner(display_name)
      `)
      .eq("candidate_id", candidate_id)
      .gte("scheduled_start", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(3);

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
    }

    // Fetch association to get current stage
    const { data: association, error: assocError } = await supabase
      .from("job_candidate_associations")
      .select(`
        current_stage_id,
        notes,
        job_hiring_stages!job_candidate_associations_current_stage_id_fkey(
          job_stages(stage_name)
        )
      `)
      .eq("candidate_id", candidate_id)
      .eq("job_id", job_id)
      .single();

    if (assocError) {
      console.error("Error fetching association:", assocError);
    }

    // Fetch latest scorecard
    const { data: scorecard, error: scorecardError } = await supabase
      .from("job_stage_scorecards")
      .select("rating, general_overview")
      .eq("candidate_id", candidate_id)
      .eq("job_id", job_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scorecardError) {
      console.error("Error fetching scorecard:", scorecardError);
    }

    // Build context for AI
    let contextParts: string[] = [];

    if (candidate) {
      contextParts.push(`## Candidate
**Name**: ${candidate.candidate_name}
**Email**: ${candidate.email || "Not provided"}
**Current Role**: ${candidate.role_current || "Unknown"} at ${candidate.company_current || "Unknown company"}
**Location**: ${[candidate.location_city, candidate.location_country].filter(Boolean).join(", ") || "Not specified"}
${candidate.profile_summary ? `**Profile**: ${candidate.profile_summary.substring(0, 300)}...` : ""}
${candidate.skills?.length ? `**Skills**: ${candidate.skills.slice(0, 10).join(", ")}` : ""}`);
    }

    if (job) {
      contextParts.push(`## Job Position
**Title**: ${job.title}
**Location**: ${job.location || "Not specified"}
${job.skills?.length ? `**Required Skills**: ${(job.skills as string[]).slice(0, 8).join(", ")}` : ""}`);
    }

    if (association) {
      const stageName = (association.job_hiring_stages as any)?.job_stages?.stage_name;
      if (stageName) {
        contextParts.push(`## Current Stage
The candidate is currently in the **${stageName}** stage.`);
      }
    }

    if (emails && emails.length > 0) {
      const emailSummaries = emails.map((e, i) => {
        const date = e.sent_at || e.received_at;
        const dateStr = date ? new Date(date).toLocaleDateString() : "Unknown date";
        const direction = e.direction === "outgoing" ? "Sent" : "Received";
        return `${i + 1}. [${dateStr}, ${direction}] Subject: "${e.subject}"
   Preview: "${(e.body_text || "").substring(0, 150)}..."`;
      }).join("\n");
      contextParts.push(`## Recent Email History
${emailSummaries}`);
    }

    if (bookings && bookings.length > 0) {
      const bookingSummaries = bookings.map(b => {
        const date = new Date(b.scheduled_start).toLocaleDateString();
        const time = new Date(b.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const config = b.booking_configurations as any;
        return `- ${config?.display_name || "Meeting"} on ${date} at ${time} (${b.status})`;
      }).join("\n");
      contextParts.push(`## Scheduled Meetings
${bookingSummaries}`);
    }

    if (scorecard) {
      contextParts.push(`## Latest Interview Feedback
**Rating**: ${scorecard.rating}
${scorecard.general_overview ? `**Summary**: ${scorecard.general_overview.substring(0, 200)}...` : ""}`);
    }

    const systemPrompt = `You are a professional recruiter writing an email to a job candidate. Write emails that are:
- Professional but warm and personable
- Concise (2-4 short paragraphs maximum)
- Action-oriented with a clear next step or call-to-action
- Natural - don't force all context into the email, only use what's relevant

Reference the candidate by their first name only. Use context naturally without making the email feel templated.`;

    const userPrompt = `${contextParts.join("\n\n")}

---

## Your Task
${prompt}

${sender_name ? `Sign off as ${sender_name}.` : "Include an appropriate professional sign-off."}

Respond with a JSON object containing "subject" and "body" fields. The body should be plain text with appropriate line breaks for paragraphs. Do not include HTML tags.`;

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating email draft:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
