import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratedQuestion {
  question_text: string;
  notes_for_interviewer: string;
  answer_type: "text" | "yes_no";
  suggested_reason: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, stageName, stageType, existingQuestions = [] } = await req.json();

    if (!jobId || !stageName || !stageType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: jobId, stageName, stageType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for fetching job data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("title, description")
      .eq("id", jobId)
      .single();

    if (jobError) {
      console.error("Error fetching job:", jobError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch job details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract plain text from HTML description
    const descriptionText = job.description
      ? job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      : "";
    
    // Truncate if too long
    const truncatedDescription = descriptionText.length > 2000 
      ? descriptionText.substring(0, 2000) + "..." 
      : descriptionText;

    // Build the system prompt with 3D Recruiting + ASK Methodology
    const systemPrompt = `You are an expert interviewer using the 3D Recruiting System and ASK Methodology to design structured interview scorecards.

## Evaluation Framework
Generate questions that assess candidates across these 5 dimensions:

1. **Competency/Skills** - Hard skills, technical abilities, hands-on experience relevant to the role. Can they DO the job?
2. **Cultural Fit** - Communication style, adaptability, alignment with team values and work environment. Will they THRIVE here?
3. **Attitude** - Drive, grit, resilience, growth mindset, intrinsic motivation. Do they have the WILL to succeed?
4. **Growth Potential** - Track record of achievement, promotion history, exceeding goals, being a top performer. Can they GROW with us?
5. **Knowledge** - Domain expertise, industry awareness, understanding of tools, function, and market. Do they KNOW the field?

## Stage-Specific Focus
Emphasize different dimensions based on the interview stage while keeping questions contextually appropriate:

- **Phone Screen / Screening**: Focus on Cultural Fit (values alignment, communication) and Attitude (motivation, grit, resilience), with basic Knowledge verification. Keep questions conversational but probing.
- **Technical Interview**: Deep-dive into Competency/Skills (problem-solving, technical scenarios, hands-on experience) and Knowledge (tools expertise, domain depth). Include practical examples and follow-ups.
- **Panel / Team Interview**: Emphasize Cultural Fit (collaboration style, team dynamics) and Attitude (adaptability, working style). Focus on how they interact and communicate.
- **Hiring Manager Interview**: Assess Growth Potential (achievement history, career trajectory, leadership indicators) and Attitude (ambition, drive, ownership). Look for evidence of being a top performer.
- **Final Interview**: Evaluate Growth Potential (long-term vision, strategic thinking) and Cultural Fit (culture add, alignment with company mission). Explore their career aspirations.
- **Assessment**: Focus on Competency/Skills (practical evaluation, case studies) and Knowledge (applied expertise, situational judgment).

## Question Guidelines
- Generate 5-8 questions tailored to the stage, ensuring coverage of the relevant dimensions for that stage
- Use behavioral questions (STAR method - Situation, Task, Action, Result) to uncover past behavior as a predictor of future performance
- Include practical "notes for interviewer" with specific signals to look for, red flags to watch out for, and follow-up prompts
- Make questions specific to the job title and description - avoid generic questions that could apply to any role
- Do NOT repeat or closely paraphrase existing questions
- Use "text" answer type for open-ended questions; "yes_no" only for simple screening questions (like "Are you authorized to work in this country?")
- Keep questions concise but meaningful - each question should have a clear purpose tied to the evaluation dimensions`;

    // Build the user prompt
    const existingQuestionsText = existingQuestions.length > 0
      ? `\n\nExisting questions to avoid duplicating:\n${existingQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`
      : "";

    const userPrompt = `Generate interview questions for this role and stage:

Job Title: ${job.title}
${truncatedDescription ? `Job Description: ${truncatedDescription}` : ""}

Interview Stage: ${stageName}
Stage Type: ${stageType}${existingQuestionsText}

Generate 5-8 tailored interview questions with interviewer notes.`;

    // Call OpenAI with tool calling for structured output
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating questions for job "${job.title}" at stage "${stageName}" (${stageType})`);

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_interview_questions",
              description: "Return 5-8 tailored interview questions with interviewer guidance notes",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: {
                          type: "string",
                          description: "The interview question to ask the candidate",
                        },
                        notes_for_interviewer: {
                          type: "string",
                          description: "Guidance for the interviewer - what to look for, red flags, follow-up suggestions",
                        },
                        answer_type: {
                          type: "string",
                          enum: ["text", "yes_no"],
                          description: "Use 'text' for open-ended questions, 'yes_no' only for simple screening questions",
                        },
                        suggested_reason: {
                          type: "string",
                          description: "Brief explanation of why this question is relevant for this role/stage",
                        },
                      },
                      required: ["question_text", "notes_for_interviewer", "answer_type", "suggested_reason"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_interview_questions" } },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "suggest_interview_questions") {
      console.error("Unexpected AI response format:", JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: "Unexpected AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const questions: GeneratedQuestion[] = JSON.parse(toolCall.function.arguments).questions;
    
    console.log(`Generated ${questions.length} questions`);

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-scorecard-questions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
