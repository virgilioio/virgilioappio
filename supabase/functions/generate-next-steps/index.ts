import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scorecard_id, candidate_id, job_id, rating, overview } = await req.json();

    console.log('[generate-next-steps] Processing request:', { scorecard_id, candidate_id, job_id, rating });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch candidate details
    const { data: candidate } = await supabase
      .from('candidates')
      .select('candidate_name, email, role_current, company_current, profile_summary, skills')
      .eq('id', candidate_id)
      .single();

    // Fetch job details
    const { data: job } = await supabase
      .from('jobs')
      .select('title, description, skills')
      .eq('id', job_id)
      .single();

    // Fetch scorecard questions and responses if available
    let questionResponses: any[] = [];
    if (scorecard_id) {
      const { data: responses } = await supabase
        .from('scorecard_question_responses')
        .select(`
          answer_text,
          answer_options,
          question:scorecard_interview_questions(question_text)
        `)
        .eq('scorecard_id', scorecard_id);
      
      questionResponses = responses || [];
    }

    // Build context for AI
    const ratingLabel = {
      definitely_no: "Definitely No - Strong rejection",
      no: "No - Not recommended to proceed",
      yes: "Yes - Recommended to proceed",
      strong_yes: "Strong Yes - Highly recommended"
    }[rating] || rating;

    const prompt = `You are an expert recruiter assistant. Based on the interview scorecard data provided, suggest the most appropriate next steps for this candidate.

## Candidate Information
- Name: ${candidate?.candidate_name || 'Unknown'}
- Current Role: ${candidate?.role_current || 'N/A'} at ${candidate?.company_current || 'N/A'}
- Profile Summary: ${candidate?.profile_summary || 'N/A'}
- Skills: ${candidate?.skills?.join(', ') || 'N/A'}

## Job Information
- Title: ${job?.title || 'Unknown'}
- Required Skills: ${job?.skills?.join(', ') || 'N/A'}

## Interview Scorecard
- Overall Rating: ${ratingLabel}
- Key Takeaways: ${overview || 'No notes provided'}

${questionResponses.length > 0 ? `## Interview Questions & Responses
${questionResponses.map(r => `Q: ${r.question?.question_text || 'Question'}\nA: ${r.answer_text || r.answer_options?.join(', ') || 'No response'}`).join('\n\n')}` : ''}

Based on this information, provide 2-3 recommended next steps. Consider:
1. The interview rating and whether the candidate should proceed
2. Any follow-up interviews or assessments needed
3. Specific concerns or strengths from the notes
4. Timeline urgency

Respond in JSON format:
{
  "recommendations": [
    {
      "action": "Brief action title (e.g., 'Move to Next Stage', 'Schedule Technical Interview', 'Reject')",
      "reasoning": "2-3 sentence explanation of why this action is recommended",
      "priority": "high" | "medium" | "low",
      "suggested_stage": "optional - name of suggested next stage if applicable"
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful recruiting assistant that provides actionable next-step recommendations based on interview feedback. Always respond in valid JSON format.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-next-steps] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let recommendations;
    try {
      recommendations = JSON.parse(content);
    } catch (e) {
      console.error('[generate-next-steps] Failed to parse AI response:', content);
      recommendations = { recommendations: [] };
    }

    console.log('[generate-next-steps] Generated recommendations:', recommendations);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-next-steps] Error:', error);
    return new Response(JSON.stringify({ error: error.message, recommendations: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
