import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";
import { atsLayout, esc, gioContent } from "../_shared/atsEmail.ts";
import { formatEmailList } from "../_shared/emailTemplate.ts";

import { openaiFetch } from '../_shared/openaiFetch.ts';
import { AI_MODELS } from '../_shared/aiModels.ts';
import { SUGGESTED_RATINGS, cleanInboundText, scorecardLink, tooLittleToDraft, toSuggestedRating, type SourceKind } from '../_shared/interviewNotes.ts';
import { REASON, setStatus, sourceForNotes } from '../_shared/interviewTranscripts.ts';
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

  // Only process-transcript-webhook calls this (with the service role key): it can
  // fetch from Fireflies and rewrite a draft, so nobody else may start it.
  const auth = req.headers.get('Authorization') ?? '';
  if (!supabaseServiceKey || auth !== `Bearer ${supabaseServiceKey}`) {
    return new Response(JSON.stringify({ error: 'Not allowed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let booking_id: string | null = null;
  let drafting = false;
  const supabaseForStatus = createClient(supabaseUrl, supabaseServiceKey);

  try {
    ({ booking_id } = await req.json());

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

    const meta = (booking.transcript_metadata || {}) as Record<string, any>;
    if (!booking.transcript_raw && !meta.fireflies_id) {
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
      transcript_length: (booking.transcript_raw || "").length,
    });

    // Fetch scorecard questions for this stage if available
    let scorecardQuestions: any[] = [];
    if (booking.job_hiring_stage?.id) {
      const { data: template } = await supabase
        .from('stage_scorecard_templates')
        .select(`
          id,
          questions:scorecard_interview_questions(
            id, question_text, answer_type, is_required, display_order, select_options, retired_at
          )
        `)
        .eq('job_hiring_stage_id', booking.job_hiring_stage.id)
        .single();

      if (template?.questions) {
        // Retired questions came with scorecards from a removed stage; they are
        // not this stage's questions (2026-10-13).
        scorecardQuestions = template.questions
          .filter((q: any) => !q.retired_at)
          .sort((a: any, b: any) => a.display_order - b.display_order);
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

    // What arrived is cleaned when it's received (process-transcript-webhook); older rows
    // still hold the whole recap email, so clean them the same way here.
    let sourceKind: SourceKind = meta.source_kind === 'summary' || meta.source_kind === 'transcript' ? meta.source_kind : 'transcript';
    let sourceText: string = booking.transcript_raw || '';
    let provider = (meta.provider || 'other') as 'fireflies' | 'read_ai' | 'other';
    let firefliesId: string | null = meta.fireflies_id ?? null;
    if (!meta.source_kind) {
      const cleaned = cleanInboundText(booking.transcript_raw || '', String(meta.from || ''));
      sourceText = cleaned.text;
      sourceKind = cleaned.kind;
      provider = cleaned.provider;
      firefliesId = cleaned.firefliesId;
    }

    // The whole conversation from Fireflies' API when there is one (step 3,
    // 2026-11-12); otherwise the recap's summary, saying why.
    const source = await sourceForNotes(
      supabase,
      { id: booking.id, tenant_id: booking.tenant_id },
      { text: sourceText, kind: sourceKind, provider, firefliesId },
      { apiKey: Deno.env.get('FIREFLIES_API_KEY') },
    );
    sourceText = source.text;
    sourceKind = source.kind;
    const interviewerName = [interviewer?.first_name, interviewer?.last_name].filter(Boolean).join(' ').trim();
    const candidateName = booking.candidate?.candidate_name || booking.candidate_name || '';

    // A full interview runs to tens of thousands of characters; the model reads it whole.
    const MAX_SOURCE = 120000;
    const transcriptContent = sourceText.length > MAX_SOURCE
      ? sourceText.substring(0, MAX_SOURCE) + '\n\n[Transcript truncated for processing...]'
      : sourceText;

    // === EMPTY CONVERSATION GUARD ===
    // Counts real content only: no recap header lines, timestamps, speaker labels,
    // join/leave notices or fillers (src: _shared/interviewNotes.ts).
    const nothingSaid = tooLittleToDraft(transcriptContent, sourceKind);
    console.log('[generate-scorecard] Source kind:', sourceKind, 'length:', transcriptContent.length, 'nothing said:', nothingSaid);

    if (nothingSaid) {
      console.log('[generate-scorecard] Empty/near-empty conversation detected, skipping AI analysis');
      await setStatus(supabase, booking_id, 'nothing_said', source.reason);
      
      const emptyMessage = sourceKind === 'summary'
        ? "The note-taker's summary of this call has nothing about the interview in it, so Gio has no notes to draft. Open the recording to check, or write your notes yourself."
        : 'No substantive conversation took place during this call. The interview may need to be rescheduled.';
      
      // Still create/update the AI draft scorecard but with empty-conversation message
      if (booking.job_candidate_association_id && booking.job_hiring_stage?.id && interviewer?.user_id) {
        const { data: existingScorecard } = await supabase
          .from('job_stage_scorecards')
          .select('id, is_ai_draft')
          .eq('association_id', booking.job_candidate_association_id)
          .eq('stage_instance_id', booking.job_hiring_stage.id)
          .eq('created_by', interviewer.user_id)
          .single();

        let scorecardId = null;
        if (existingScorecard?.is_ai_draft) {
          await supabase
            .from('job_stage_scorecards')
            .update({
              general_overview: emptyMessage,
              ai_suggested_rating: null,
              source_booking_id: booking_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingScorecard.id);
          scorecardId = existingScorecard.id;
        } else if (!existingScorecard) {
          const { data: newScorecard } = await supabase
            .from('job_stage_scorecards')
            .insert({
              association_id: booking.job_candidate_association_id,
              candidate_id: booking.candidate_id,
              job_id: booking.job_id,
              stage_instance_id: booking.job_hiring_stage.id,
              created_by: interviewer.user_id,
              rating: 'yes',
              general_overview: emptyMessage,
              is_ai_draft: true,
              source_booking_id: booking_id,
              ai_suggested_rating: null,
            })
            .select('id')
            .single();
          scorecardId = newScorecard?.id;
        }

        // Store summary in booking
        await supabase
          .from('scheduled_bookings')
          .update({ transcript_summary: emptyMessage })
          .eq('id', booking_id);

        return new Response(JSON.stringify({
          status: 'empty_conversation',
          booking_id,
          scorecard_id: scorecardId,
          message: emptyMessage,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // === END EMPTY CONVERSATION GUARD ===

    const systemPrompt = `You are an expert interview analyst helping recruiters document interview feedback. Your task is to analyze an interview transcript and generate structured, professional interview notes.

CRITICAL — EMPTY OR NEAR-EMPTY TRANSCRIPTS:
If the transcript contains only greetings, silence markers, or system messages with no substantive interview discussion, respond with:
- general_overview: "No substantive interview discussion took place during this call."
- suggested_rating: "not_enough"
- question_responses: all set to "[No discussion took place during this interview]"
Do NOT use the candidate's resume, profile, or job description to fabricate interview notes. Your analysis must be based solely on what was actually said during the interview.

${source.full ? `SOURCE: The full transcript of the call. Each line is one turn: "[m:ss] Speaker name: what they said", the time counted from the start of the call. ${interviewerName ? `${interviewerName} is the interviewer` : 'The interviewer works for the hiring team'}${candidateName ? `; ${candidateName} is the candidate` : ''}. The note-taker names speakers from the calendar, so someone may appear under another name or as "Speaker"; work out who is who from what they say. When you quote, quote exactly and add the time it was said, e.g. "..." (12:05).

` : ''}${sourceKind === 'summary' ? `SOURCE: What you have is the note-taker's short written summary of the call, NOT a word-for-word transcript. Write only what the summary states. Do not invent quotes, examples, numbers or details, and do not fill gaps from the candidate's resume or the job description. Start the general_overview with one line saying the notes come from the note-taker's summary, not the full transcript. Instead of NOTABLE QUOTES, write "No transcript, so no quotes." Keep the notes as short as the summary allows.

` : ''}LANGUAGE: Write the general_overview, its section headings and every answer in the language the interview was held in (the language of the source below), whatever the language of these instructions, the job or the resume.

Guidelines:
- Be objective and evidence-based - cite specific examples from the transcript
- Focus on job-relevant competencies and behaviors
- Highlight both strengths and areas for development
- Use professional language appropriate for HR documentation
- Structure notes clearly with headers and bullet points
- Suggest an overall rating on the scorecard's five-point scale, from what was said measured against this job's requirements: strong_yes, yes, lean_yes, lean_no or strong_no. Never default to yes. If the source says too little about the job's requirements to judge, use not_enough
- CRITICAL: If a scorecard question topic was NOT discussed during the interview, explicitly state that rather than inferring or fabricating an answer. Honesty about information gaps is far more valuable than completeness. Never guess or extrapolate answers for topics not covered in the transcript.

Your general_overview should follow this format:
1. OVERALL IMPRESSION (2-3 sentences)
2. KEY STRENGTHS (3-5 bullet points with examples)
3. AREAS FOR DEVELOPMENT (2-3 bullet points)
4. NOTABLE QUOTES (2-3 direct quotes that stood out)
5. RECOMMENDED RATING (Strong yes, Yes, Lean yes, Lean no, Strong no, or Not enough to recommend) with justification

${questionsContext}`;

    const userPrompt = `${candidateContext}\n${jobContext}\n${stageContext}\n\nINTERVIEW TRANSCRIPT:\n${transcriptContent}\n\nPlease analyze this interview and submit your structured evaluation using the submit_scorecard tool.`;

    console.log('[generate-scorecard] Calling OpenAI with tool calling...');
    await setStatus(supabase, booking_id, 'drafting', source.reason);
    drafting = true;

    // Build request body — use tool calling when questions exist, plain text as fallback
    const hasQuestions = scorecardQuestions.length > 0;
    const requestBody: any = {
      model: AI_MODELS.reasoning,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 8000,
      reasoning_effort: 'medium',
    };

    if (hasQuestions) {
      requestBody.tools = [buildToolDefinition(scorecardQuestions)];
      requestBody.tool_choice = { type: 'function', function: { name: 'submit_scorecard' } };
    }

    const response = await openaiFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }, 'generate-scorecard-from-transcript');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-scorecard] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();

    // Parse response — tool call or plain text
    let generatedNotes: string;
    let suggestedRating: string | null = null;
    let questionResponses: Array<{ question_id: string; answer_text?: string; answer_options?: string[] }> = [];

    const toolCall = aiResponse.choices[0]?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function?.name === 'submit_scorecard') {
      // Tool calling path — structured output
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        const rawOverview = parsed.general_overview || '';
        // OpenAI sometimes returns an object instead of a markdown string
        if (typeof rawOverview === 'object' && rawOverview !== null) {
          generatedNotes = convertOverviewObjectToMarkdown(rawOverview);
          console.log('[generate-scorecard] Converted object general_overview to markdown');
        } else {
          generatedNotes = rawOverview;
        }
        suggestedRating = toSuggestedRating(parsed.suggested_rating);
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
      const ratingMatch = generatedNotes.match(/RECOMMENDED RATING[^:\n]*:\s*\**\s*(Strong Yes|Lean Yes|Lean No|Strong No|Definitely No|Yes|No)\b/i);
      suggestedRating = ratingMatch ? toSuggestedRating(ratingMatch[1]) : null;
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

    // Send notification email to interviewer — once per booking.
    // Claim the notification atomically so a re-run (or a duplicate delivery)
    // regenerates the draft without re-emailing the interviewer.
    let notificationClaimed = false;
    if (interviewer?.email) {
      const { data: claimed } = await supabase
        .from('scheduled_bookings')
        .update({ transcript_notified_at: new Date().toISOString() })
        .eq('id', booking_id)
        .is('transcript_notified_at', null)
        .select('id');
      notificationClaimed = !!claimed && claimed.length > 0;
      if (!notificationClaimed) {
        console.log('[generate-scorecard] Notification already sent for booking, skipping email:', booking_id);
      }
    }

    if (interviewer?.email && notificationClaimed) {
      // The in-job profile with your own scorecard open (?open=scorecard was never read).
      const scorecardUrl = scorecardLink(frontendUrl, booking.job_id, booking.candidate_id);

      try {

        const candName = booking.candidate?.candidate_name || 'the candidate';
        await resend.emails.send({
          from: 'Gio <noreply@app.gogio.io>',
          to: [interviewer.email],
          subject: `Interview notes ready: ${booking.candidate?.candidate_name || 'Candidate'}`,
          html: atsLayout({
            preheader: `Gio wrote up your interview with ${candName}. Review it and submit your scorecard.`,
            product: 'Scorecards',
            eyebrow: 'Interview notes ready',
            title: `Your notes on ${candName} are ready`,
            lead: `Hi <strong style="color:#1F2230;font-weight:600">${esc(interviewer.first_name || 'there')}</strong>, Gio read the transcript of your interview with <strong style="color:#1F2230;font-weight:600">${esc(candName)}</strong>${booking.job?.title ? ` for <strong style="color:#1F2230;font-weight:600">${esc(booking.job.title)}</strong>` : ''} and drafted your scorecard.`,
            body: gioContent(`<p>Take a couple of minutes to:</p>${formatEmailList([
              'Check the notes are accurate',
              'Add or change anything',
              'Confirm your overall rating',
              'Submit your scorecard',
            ])}`),
            cta: { label: 'Review and submit', url: scorecardUrl },
            why: "You're getting this because you interviewed this candidate and the meeting's transcript reached Gio.",
          }),
        });

        console.log('[generate-scorecard] Notification email sent to:', interviewer.email);
      } catch (emailError) {
        console.error('[generate-scorecard] Failed to send notification email:', emailError);
        // Release the claim so a later run can retry the notification
        await supabase
          .from('scheduled_bookings')
          .update({ transcript_notified_at: null })
          .eq('id', booking_id);
      }

    }

    await setStatus(supabase, booking_id, 'drafted', source.reason);
    drafting = false;

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
    if (booking_id && drafting) await setStatus(supabaseForStatus, booking_id, 'failed', REASON.failed);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// --- Helper functions ---

function convertOverviewObjectToMarkdown(obj: any): string {
  const sections: string[] = [];

  // Handle nested { general_overview: { ... } } wrapper
  const data = obj.general_overview && typeof obj.general_overview === 'object' ? obj.general_overview : obj;

  if (data.overall_impression) {
    sections.push(`## Overall Impression\n\n${data.overall_impression}`);
  }
  if (Array.isArray(data.key_strengths) && data.key_strengths.length > 0) {
    sections.push(`## Key Strengths\n\n${data.key_strengths.map((s: string) => `- ${s}`).join('\n')}`);
  }
  if (Array.isArray(data.areas_for_development) && data.areas_for_development.length > 0) {
    sections.push(`## Areas for Development\n\n${data.areas_for_development.map((s: string) => `- ${s}`).join('\n')}`);
  }
  if (Array.isArray(data.notable_quotes) && data.notable_quotes.length > 0) {
    sections.push(`## Notable Quotes\n\n${data.notable_quotes.map((q: string) => `> ${q}`).join('\n\n')}`);
  }
  if (data.recommended_rating || data.justification) {
    const ratingLabel = data.recommended_rating ? data.recommended_rating.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '';
    sections.push(`## Recommended Rating: ${ratingLabel}\n\n${data.justification || ''}`);
  }

  // Fallback: if no known keys matched, JSON.stringify as code block
  if (sections.length === 0) {
    return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
  }

  return sections.join('\n\n');
}

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
SCORECARD QUESTIONS — respond to each, but ONLY with evidence actually found in the transcript:
${lines.join('\n')}

IMPORTANT: If a question's topic was NOT discussed or covered during the interview, do NOT fabricate or infer an answer. Instead:
- For "text" questions: set answer_text to exactly: "[Not discussed during this interview]"
- For "yes_no" questions: set answer_text to "[Not discussed during this interview]" and set answer_options to an empty array []
- For "single_select" questions: set answer_text to "[Not discussed during this interview]" and set answer_options to an empty array []
- For "multi_select" questions: set answer_text to "[Not discussed during this interview]" and set answer_options to an empty array []

When a question WAS discussed, populate the response normally:
- For "text" questions: set answer_text with your evidence-based response
- For "yes_no" questions: set answer_options to ["yes"] or ["no"]
- For "single_select" questions: set answer_options to an array with exactly one of the provided options
- For "multi_select" questions: set answer_options to an array with one or more of the provided options
- Always use the exact question id provided in brackets
- Only provide substantive answers when you can cite specific evidence from the transcript`;
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
            enum: [...SUGGESTED_RATINGS, 'not_enough'],
            description: "Overall rating on the scorecard's five-point scale, judged against this job's requirements; not_enough when the source doesn't cover enough of them",
          },
          question_responses: {
            type: 'array',
            description: 'Structured responses to each scorecard question. Include ALL questions — for questions not discussed in the interview, set answer_text to "[Not discussed during this interview]" and answer_options to [].',
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
