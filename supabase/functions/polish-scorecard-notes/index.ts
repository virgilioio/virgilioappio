import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

import { openaiFetch } from '../_shared/openaiFetch.ts';
import { AI_MODELS } from '../_shared/aiModels.ts';
import {
  NOTES_RULES,
  criteriaPrompt,
  jobCriteria,
  languageCode,
  notesTool,
  renderNotes,
  settleRecommendation,
  type ModelNotes,
} from '../_shared/interviewNotesFormat.ts';

// Polish notes (2026-11-12, interview notes step 4): the interviewer's own notes and
// answers rewritten in the same structure as Gio's drafts (Summary, Strengths,
// Concerns, Motivation & logistics, Not covered, Recommendation against the job's
// requirements), in the language the notes are written in. Returns Markdown; the
// sheet turns it into the box's HTML. Reads under the caller's own access.

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
      .select('candidate_name, role_current, company_current')
      .eq('id', candidateId)
      .single();

    if (candidateError) {
      console.error('Error fetching candidate:', candidateError);
      throw new Error('Failed to fetch candidate data');
    }

    // Fetch job context from stage instance
    const { data: stageInstance, error: stageError } = await supabase
      .from('job_hiring_stages')
      .select(`
        job_id,
        jobs!inner(
          title, description, skills, skill_priorities, min_years_experience, max_years_experience,
          location, additional_locations, location_requirement, work_mode,
          salary_min, salary_max, salary_period, currency,
          budget_salary_min, budget_salary_max, budget_currency, budget_period
        )
      `)
      .eq('id', stageInstanceId)
      .single();

    if (stageError) {
      console.error('Error fetching job context:', stageError);
    }

    const job: any = (stageInstance as any)?.jobs || {};
    const jobTitle = job.title || 'Position';
    const criteria = jobCriteria(job);

    // Format questions and answers
    const formattedQuestionsAndAnswers = (Array.isArray(questions) ? questions : []).map((q: any, idx: number) => {
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

    const systemPrompt = `You turn an interviewer's rough notes into clear interview notes for the hiring team, measured against what this job needs. The interviewer always makes the decision; your recommendation must be accurate and rest only on their notes and answers.

SOURCE: The interviewer's own notes and their answers to the scorecard questions, not a transcript. Keep every fact they wrote, add none: no quotes, no times, nothing filled in from the resume or the job description. Where the notes don't cover a requirement, judge it not_discussed and list it in not_covered.

${NOTES_RULES}

LANGUAGE: the language of the interviewer's notes (and answers); for mixed notes, the language most of the notes are in.`;

    const userPrompt = [
      `JOB: ${jobTitle}`,
      job.description ? `JOB DESCRIPTION:\n${stripHtml(job.description).slice(0, 4000)}` : '',
      criteriaPrompt(criteria, job),
      `CANDIDATE (context only, never evidence): ${candidate.candidate_name}${candidate.role_current ? `, ${candidate.role_current}` : ''}${candidate.company_current ? ` at ${candidate.company_current}` : ''}`,
      formattedQuestionsAndAnswers ? `INTERVIEW QUESTIONS AND THE INTERVIEWER'S ANSWERS:\n${formattedQuestionsAndAnswers}` : '',
      `INTERVIEWER'S NOTES:\n${currentNotes ? stripHtml(currentNotes) : 'No notes written.'}`,
      'Submit the notes with submit_interview_notes.',
    ].filter(Boolean).join('\n\n');

    console.log('Calling OpenAI API...');

    const response = await openaiFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODELS.reasoning,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 8000,
        reasoning_effort: 'low',
        tools: [notesTool(false)],
        tool_choice: { type: 'function', function: { name: 'submit_interview_notes' } },
      }),
    }, 'polish-scorecard-notes', { timeoutMs: 90_000 });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No notes came back');
    const notes: ModelNotes = JSON.parse(toolCall.function.arguments);
    const recommendation = settleRecommendation(notes.recommendation, notes.criteria, criteria, {
      full: false,
      sourceKind: 'transcript',
      language: languageCode(notes.language),
    });
    // The interviewer's own notes: no "from the summary" line, no quotes.
    const polishedNotes = renderNotes(notes, { ...recommendation, source_kind: 'transcript' }, { full: false });

    console.log('Polish notes successful');

    return new Response(
      JSON.stringify({ polishedNotes, recommendation }),
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
