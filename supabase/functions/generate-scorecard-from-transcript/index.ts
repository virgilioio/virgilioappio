import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.gogio.io';

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-scorecard] Processing booking:', booking_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch full booking context (without FK join to profiles)
    const { data: booking, error: bookingError } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        job:jobs(id, title, description, organization_id),
        candidate:candidates(id, candidate_name, email, profile_summary, resume_url, skills, role_current, company_current),
        job_hiring_stage:job_hiring_stages(
          id,
          stage:job_stages(id, stage_name)
        )
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[generate-scorecard] Booking not found:', bookingError);
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch interviewer separately (no FK constraint exists)
    let interviewer: any = null;
    if (booking.interviewer_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('user_id', booking.interviewer_id)
        .single();
      interviewer = profileData;
    }

    // Skip scorecard generation for simple bookings (no pipeline context)
    if (!booking.candidate_id || !booking.job_hiring_stage_id) {
      console.log('[generate-scorecard] Simple booking detected - skipping scorecard generation');
      return new Response(JSON.stringify({ 
        status: 'skipped',
        reason: 'simple_booking_no_pipeline_context',
        booking_id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!booking.transcript_raw) {
      console.error('[generate-scorecard] No transcript found for booking');
      return new Response(JSON.stringify({ error: 'No transcript available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-scorecard] Booking loaded:', {
      candidate: booking.candidate?.candidate_name,
      job: booking.job?.title,
      stage: booking.job_hiring_stage?.stage?.stage_name,
      transcript_length: booking.transcript_raw.length,
    });

    // Fetch scorecard questions for this stage if available
    let scorecardQuestions: any[] = [];
    if (booking.job_hiring_stage?.id) {
      const { data: template } = await supabase
        .from('stage_scorecard_templates')
        .select(`
          id,
          questions:scorecard_interview_questions(
            id, question_text, answer_type, is_required, display_order, select_options
          )
        `)
        .eq('job_hiring_stage_id', booking.job_hiring_stage.id)
        .single();

      if (template?.questions) {
        scorecardQuestions = template.questions.sort((a: any, b: any) => a.display_order - b.display_order);
      }
    }

    // Build context for AI
    const candidateContext = booking.candidate ? `
CANDIDATE PROFILE:
- Name: ${booking.candidate.candidate_name}
- Current Role: ${booking.candidate.role_current || 'Not specified'}
- Current Company: ${booking.candidate.company_current || 'Not specified'}
- Skills: ${booking.candidate.skills?.join(', ') || 'Not specified'}
- Profile Summary: ${booking.candidate.profile_summary || 'Not available'}
` : '';

    const jobContext = booking.job ? `
JOB CONTEXT:
- Position: ${booking.job.title}
- Description: ${booking.job.description?.substring(0, 1000) || 'Not available'}
` : '';

    const stageContext = booking.job_hiring_stage?.stage ? `
INTERVIEW STAGE: ${booking.job_hiring_stage.stage.stage_name}
` : '';

    // Build enhanced questions context with IDs, types, and options for tool calling
    const questionsContext = buildQuestionsContext(scorecardQuestions);

    // Truncate transcript if too long (keep first 15000 chars)
    const transcriptContent = booking.transcript_raw.length > 15000 
      ? booking.transcript_raw.substring(0, 15000) + '\n\n[Transcript truncated for processing...]'
      : booking.transcript_raw;

    const systemPrompt = `You are an expert interview analyst helping recruiters document interview feedback. Your task is to analyze an interview transcript and generate structured, professional interview notes.

Guidelines:
- Be objective and evidence-based - cite specific examples from the transcript
- Focus on job-relevant competencies and behaviors
- Highlight both strengths and areas for development
- Use professional language appropriate for HR documentation
- Structure notes clearly with headers and bullet points
- Suggest an overall rating based on the evidence (strong_yes, yes, no, definitely_no)

Your general_overview should follow this format:
1. OVERALL IMPRESSION (2-3 sentences)
2. KEY STRENGTHS (3-5 bullet points with examples)
3. AREAS FOR DEVELOPMENT (2-3 bullet points)
4. NOTABLE QUOTES (2-3 direct quotes that stood out)
5. RECOMMENDED RATING with justification

${questionsContext}`;

    const userPrompt = `${candidateContext}\n${jobContext}\n${stageContext}\n\nINTERVIEW TRANSCRIPT:\n${transcriptContent}\n\nPlease analyze this interview and submit your structured evaluation using the submit_scorecard tool.`;

    console.log('[generate-scorecard] Calling OpenAI with tool calling...');

    // Build request body — use tool calling when questions exist, plain text as fallback
    const hasQuestions = scorecardQuestions.length > 0;
    const requestBody: any = {
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 3000,
    };

    if (hasQuestions) {
      requestBody.tools = [buildToolDefinition(scorecardQuestions)];
      requestBody.tool_choice = { type: 'function', function: { name: 'submit_scorecard' } };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-scorecard] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();

    // Parse response — tool call or plain text
    let generatedNotes: string;
    let suggestedRating = 'yes';
    let questionResponses: Array<{ question_id: string; answer_text?: string; answer_options?: string[] }> = [];

    const toolCall = aiResponse.choices[0]?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function?.name === 'submit_scorecard') {
      // Tool calling path — structured output
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        generatedNotes = parsed.general_overview || '';
        suggestedRating = parsed.suggested_rating || 'yes';
        questionResponses = parsed.question_responses || [];
        console.log('[generate-scorecard] Tool call parsed successfully, questions:', questionResponses.length);
      } catch (parseErr) {
        console.error('[generate-scorecard] Failed to parse tool call, falling back:', parseErr);
        // Fallback: try to use message content
        generatedNotes = aiResponse.choices[0]?.message?.content || '';
      }
    } else {
      // Plain text fallback (no questions or tool call failed)
      generatedNotes = aiResponse.choices[0]?.message?.content || '';
    }

    if (!generatedNotes) {
      throw new Error('No content generated from AI');
    }

    // Extract suggested rating from prose if not set by tool call
    if (!toolCall) {
      const ratingMatch = generatedNotes.match(/RECOMMENDED RATING:\s*(Strong Yes|Yes|No|Definitely No)/i);
      if (ratingMatch) {
        const ratingMap: Record<string, string> = {
          'strong yes': 'strong_yes',
          'yes': 'yes',
          'no': 'no',
          'definitely no': 'definitely_no',
        };
        suggestedRating = ratingMap[ratingMatch[1].toLowerCase()] || 'yes';
      }
    }

    console.log('[generate-scorecard] AI notes generated, length:', generatedNotes.length);

    // Validate question IDs — only keep responses whose question_id exists in actual questions
    const validQuestionIds = new Set(scorecardQuestions.map((q: any) => q.id));
    questionResponses = questionResponses.filter(r => validQuestionIds.has(r.question_id));
    console.log('[generate-scorecard] Validated question responses:', questionResponses.length);

    // Store summary in booking
    await supabase
      .from('scheduled_bookings')
      .update({
        transcript_summary: generatedNotes,
      })
      .eq('id', booking_id);

    // Check if a scorecard already exists for this interviewer/stage/candidate
    let scorecardId = null;
    
    if (booking.job_candidate_association_id && booking.job_hiring_stage?.id && interviewer?.user_id) {
      const { data: existingScorecard } = await supabase
        .from('job_stage_scorecards')
        .select('id, is_ai_draft')
        .eq('association_id', booking.job_candidate_association_id)
        .eq('stage_instance_id', booking.job_hiring_stage.id)
        .eq('created_by', interviewer.user_id)
        .single();

      if (existingScorecard) {
        // Update existing scorecard if it's still a draft
        if (existingScorecard.is_ai_draft) {
          const { error: updateError } = await supabase
            .from('job_stage_scorecards')
            .update({
              general_overview: generatedNotes,
              ai_suggested_rating: suggestedRating,
              source_booking_id: booking_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingScorecard.id);

          if (!updateError) {
            scorecardId = existingScorecard.id;
            console.log('[generate-scorecard] Updated existing draft scorecard:', scorecardId);

            // Idempotency: delete old AI-generated question responses before inserting new ones
            if (questionResponses.length > 0) {
              await supabase
                .from('scorecard_question_responses')
                .delete()
                .eq('scorecard_id', scorecardId);
              console.log('[generate-scorecard] Cleared old question responses for idempotency');
            }
          }
        } else {
          console.log('[generate-scorecard] Existing scorecard is already submitted, not updating');
          scorecardId = existingScorecard.id;
        }
      } else {
        // Create new draft scorecard
        const { data: newScorecard, error: insertError } = await supabase
          .from('job_stage_scorecards')
          .insert({
            association_id: booking.job_candidate_association_id,
            candidate_id: booking.candidate_id,
            job_id: booking.job_id,
            stage_instance_id: booking.job_hiring_stage.id,
            created_by: interviewer.user_id,
            rating: 'yes',
            general_overview: generatedNotes,
            is_ai_draft: true,
            source_booking_id: booking_id,
            ai_suggested_rating: suggestedRating,
          })
          .select('id')
          .single();

        if (!insertError && newScorecard) {
          scorecardId = newScorecard.id;
          console.log('[generate-scorecard] Created new draft scorecard:', scorecardId);

          // Update booking with scorecard reference
          await supabase
            .from('scheduled_bookings')
            .update({ draft_scorecard_id: scorecardId })
            .eq('id', booking_id);
        } else {
          console.error('[generate-scorecard] Failed to create scorecard:', insertError);
        }
      }
    }

    // Insert per-question AI responses
    if (scorecardId && questionResponses.length > 0) {
      const rows = questionResponses.map(r => ({
        scorecard_id: scorecardId,
        question_id: r.question_id,
        answer_text: r.answer_text || null,
        answer_options: r.answer_options || null,
      }));

      const { error: qrError } = await supabase
        .from('scorecard_question_responses')
        .insert(rows);

      if (qrError) {
        console.error('[generate-scorecard] Failed to insert question responses:', qrError);
      } else {
        console.log('[generate-scorecard] Inserted', rows.length, 'question responses');
      }
    }

    // Send notification email to interviewer
    if (interviewer?.email) {
      const scorecardUrl = scorecardId && booking.job_id && booking.candidate_id
        ? `${frontendUrl}/jobs/${booking.job_id}?candidate=${booking.candidate_id}&open=scorecard`
        : `${frontendUrl}/jobs/${booking.job_id}?candidate=${booking.candidate_id}`;

      try {
        await resend.emails.send({
          from: 'GoGio <noreply@app.gogio.io>',
          to: [interviewer.email],
          subject: `📝 Interview notes ready: ${booking.candidate?.candidate_name || 'Candidate'}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a; margin-bottom: 20px;">Your Interview Notes Are Ready</h2>
              
              <p style="color: #4a4a4a; line-height: 1.6;">
                Hi ${interviewer.first_name || 'there'},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6;">
                We've processed the transcript from your interview with <strong>${booking.candidate?.candidate_name || 'the candidate'}</strong>
                ${booking.job?.title ? ` for the <strong>${booking.job.title}</strong> position` : ''}.
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6;">
                AI-generated interview notes have been prepared for your review. Please take a moment to:
              </p>
              
              <ul style="color: #4a4a4a; line-height: 1.8;">
                <li>Review the AI-generated notes for accuracy</li>
                <li>Make any edits or additions</li>
                <li>Confirm your overall rating</li>
                <li>Submit your scorecard</li>
              </ul>
              
              <div style="margin: 30px 0;">
                <a href="${scorecardUrl}" 
                   style="background: #6F3FF5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500;">
                  Review & Submit Scorecard
                </a>
              </div>
              
              <p style="color: #888; font-size: 14px; margin-top: 30px;">
                This email was sent by GoGio's interview management system.
              </p>
            </div>
          `,
        });

        console.log('[generate-scorecard] Notification email sent to:', interviewer.email);
      } catch (emailError) {
        console.error('[generate-scorecard] Failed to send notification email:', emailError);
      }
    }

    return new Response(JSON.stringify({
      status: 'success',
      booking_id,
      scorecard_id: scorecardId,
      suggested_rating: suggestedRating,
      notes_length: generatedNotes.length,
      questions_filled: questionResponses.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-scorecard] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// --- Helper functions ---

function buildQuestionsContext(questions: any[]): string {
  if (questions.length === 0) return '';

  const lines = questions
    .filter((q: any) => q.answer_type !== 'salary_expectations') // Skip salary — too structured
    .map((q: any, i: number) => {
      let instruction = '';
      switch (q.answer_type) {
        case 'text':
          instruction = 'provide a detailed text answer with evidence from the transcript';
          break;
        case 'yes_no':
          instruction = 'answer "yes" or "no"';
          break;
        case 'single_select':
          instruction = `pick exactly one option from: ${formatOptions(q.select_options)}`;
          break;
        case 'multi_select':
          instruction = `pick one or more options from: ${formatOptions(q.select_options)}`;
          break;
        default:
          instruction = 'provide a text answer';
      }
      return `${i + 1}. [id: ${q.id}] "${q.question_text}" (type: ${q.answer_type}) — ${instruction}`;
    });

  if (lines.length === 0) return '';

  return `
SCORECARD QUESTIONS (you MUST respond to each with evidence from the transcript):
${lines.join('\n')}

For each question, populate the question_responses array in your tool call:
- For "text" questions: set answer_text with your response
- For "yes_no" questions: set answer_options to ["yes"] or ["no"]
- For "single_select" questions: set answer_options to an array with exactly one of the provided options
- For "multi_select" questions: set answer_options to an array with one or more of the provided options
- Always use the exact question id provided in brackets`;
}

function formatOptions(selectOptions: any): string {
  if (!selectOptions) return 'N/A';
  if (Array.isArray(selectOptions)) {
    // Handle both string arrays and object arrays with label/value
    return selectOptions.map((o: any) => typeof o === 'string' ? o : o.label || o.value || String(o)).join(' / ');
  }
  return String(selectOptions);
}

function buildToolDefinition(questions: any[]) {
  return {
    type: 'function' as const,
    function: {
      name: 'submit_scorecard',
      description: 'Submit the complete interview analysis including general overview, suggested rating, and per-question responses',
      parameters: {
        type: 'object',
        properties: {
          general_overview: {
            type: 'string',
            description: 'Full analysis in markdown format covering overall impression, key strengths, areas for development, notable quotes, and rating justification',
          },
          suggested_rating: {
            type: 'string',
            enum: ['strong_yes', 'yes', 'no', 'definitely_no'],
            description: 'Overall interview rating based on evidence',
          },
          question_responses: {
            type: 'array',
            description: 'Structured responses to each scorecard question',
            items: {
              type: 'object',
              properties: {
                question_id: {
                  type: 'string',
                  description: 'The exact UUID of the question from the scorecard',
                },
                answer_text: {
                  type: 'string',
                  description: 'Text answer for text-type questions',
                },
                answer_options: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Selected option(s) for yes_no, single_select, or multi_select questions',
                },
              },
              required: ['question_id'],
            },
          },
        },
        required: ['general_overview', 'suggested_rating', 'question_responses'],
      },
    },
  };
}
