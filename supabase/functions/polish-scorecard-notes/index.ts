import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Get Supabase client with user's auth
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } }
    });

    // Parse request body
    const { candidateId, stageInstanceId, currentNotes, questions } = await req.json();

    console.log('Polish notes request:', { candidateId, stageInstanceId, questionsCount: questions?.length });

    // Fetch candidate profile
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('profile_summary, candidate_name')
      .eq('id', candidateId)
      .single();

    if (candidateError) {
      console.error('Error fetching candidate:', candidateError);
      throw new Error('Failed to fetch candidate data');
    }

    // Get candidate profile
    let candidateProfile = candidate.profile_summary || '';
    if (!candidateProfile) {
      candidateProfile = `${candidate.candidate_name} - No profile summary available`;
    }

    // Fetch job context from stage instance
    const { data: stageInstance, error: stageError } = await supabase
      .from('job_hiring_stages')
      .select(`
        job_id,
        jobs!inner(
          title,
          description
        )
      `)
      .eq('id', stageInstanceId)
      .single();

    if (stageError) {
      console.error('Error fetching job context:', stageError);
    }

    const jobTitle = stageInstance?.jobs?.title || 'Position';
    const jobDescription = stageInstance?.jobs?.description || '';

    // Format questions and answers
    const formattedQuestionsAndAnswers = questions.map((q: any, idx: number) => {
      let answer = 'Not answered';
      
      if (q.answer_type === 'salary_expectations' && q.answerText) {
        // Format salary with currency and period for better AI context
        const amount = parseFloat(q.answerText);
        const formattedAmount = !isNaN(amount) 
          ? amount.toLocaleString('en-US') 
          : q.answerText;
        const currency = q.salary_config?.currency || 'USD';
        const period = q.salary_config?.period || 'annually';
        answer = `${formattedAmount} ${currency} (${period})`;
      } else if (q.answerText) {
        answer = q.answerText;
      } else if (q.answerOptions && q.answerOptions.length > 0) {
        answer = q.answerOptions.join(', ');
      }

      return `Q${idx + 1}. ${q.question_text}\nA: ${answer}`;
    }).join('\n\n');

    // Construct AI prompt
    const systemPrompt = `Create professional interview notes for a candidate using the following structure:

1. Candidate Overview — Summarize the candidate's background, education, relevant experience, and current or most recent role. Include industries, company types, and sales motion exposure (e.g., SaaS, SMB, Mid-Market, Enterprise, full cycle, inbound/outbound).
2. Key Strengths — Highlight 4–6 bullet points that capture the candidate's top abilities, such as communication skills, sales methodologies used, adaptability, prospecting discipline, strategic thinking, consultative selling, cross-functional collaboration, and measurable results or metrics.
3. Growth Areas — Outline 1–2 developmental areas or learning opportunities. Keep these constructive and realistic, focused on coaching, adaptation, or market-specific knowledge.
4. Motivation & Personal Context — Summarize the candidate's personal drivers, career goals, and cultural fit indicators (e.g., coachability, curiosity, resilience, or team mindset). Include any relevant personal details that reflect stability, motivation, or professional maturity.
5. Assessment Summary — Provide a final qualitative evaluation that synthesizes the candidate's fit for the specific role. Emphasize their readiness, alignment with Motive's culture, and the level of confidence in recommending next steps. End with a clear recommendation line (e.g., "Strongly recommend advancing to panel," "Recommended for next stage," or "Not a fit for this role currently").

Tone & Format:

* Professional and concise
* Use clear subheadings and bullet points
* Keep the writing factual, neutral, and readable for internal use.
* Reflect the language and structure below:

Candidate Overview

[Brief summary paragraph]

Key Strengths

* [Strength 1]
* [Strength 2]
* [Strength 3]

Growth Areas

* [Growth Area 1]
* [Growth Area 2]

Motivation & Personal Context
[Brief paragraph capturing motivation, context, or career aspirations]

Assessment Summary
[Final evaluative paragraph summarizing fit, readiness, and recommendation]

Recommendation: [Advance / Hold / Reject]`;

    const userPrompt = `Please create comprehensive interview notes for the following candidate.

**Candidate Profile:**
${candidateProfile}

**Position:**
${jobTitle}
${jobDescription ? `\n\n**Job Description:**\n${jobDescription}` : ''}

**Interview Questions & Candidate Responses:**
${formattedQuestionsAndAnswers}

**Interviewer's Raw Notes:**
${currentNotes || "No additional notes provided."}

---

Based on the above information, create professional interview notes following the exact structure specified in your system instructions. Ensure all sections are complete, factual, and provide actionable insights for the hiring team.`;

    console.log('Calling OpenAI API...');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const polishedNotes = data.choices[0].message.content;

    console.log('Polish notes successful');

    return new Response(
      JSON.stringify({ polishedNotes }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in polish-scorecard-notes function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
