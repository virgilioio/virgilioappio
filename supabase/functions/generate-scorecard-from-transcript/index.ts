import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";
import { atsLayout, esc, gioContent } from "../_shared/atsEmail.ts";
import { formatEmailList } from "../_shared/emailTemplate.ts";

import { openaiFetch } from '../_shared/openaiFetch.ts';
import { AI_MODELS } from '../_shared/aiModels.ts';
import { cleanInboundText, scorecardLink, tooLittleToDraft, type SourceKind } from '../_shared/interviewNotes.ts';
import { REASON, setStatus, sourceForNotes } from '../_shared/interviewTranscripts.ts';
import {
  NOTES_RULES,
  answerRows,
  criteriaPrompt,
  jobCriteria,
  languageCode,
  notesTool,
  payBand,
  questionsPrompt,
  renderNotes,
  salaryAmount,
  salaryVerdict,
  settleRecommendation,
  type ModelNotes,
  type QuestionForNotes,
  type Verdict,
} from '../_shared/interviewNotesFormat.ts';
import { loadCurrencyRates, normaliseSalary } from '../_shared/salary.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** "<p>..</p>" to plain text, for the job description in the prompt. */
const plain = (html: string | null | undefined) =>
  String(html ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Only the server starts this: process-transcript-webhook (service role key) or a
  // run from the database (x-internal-secret, as the scheduled jobs send). It can
  // fetch from Fireflies and rewrite a draft, so nobody else may.
  const auth = req.headers.get('Authorization') ?? '';
  const internal = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
  const allowed =
    (!!supabaseServiceKey && auth === `Bearer ${supabaseServiceKey}`) ||
    (!!internal && req.headers.get('x-internal-secret') === internal);
  if (!allowed) return json({ error: 'Not allowed' }, 401);

  let body: { booking_id?: string; find?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'booking_id is required' }, 400);
  }
  if (!body.booking_id) return json({ error: 'booking_id is required' }, 400);

  // Drafting takes a minute or two (a whole interview, a reasoning model): answer at
  // once and keep working, so no caller times out. interview_transcripts.status says
  // where it got to.
  const work = draft(supabaseUrl, supabaseServiceKey, body.booking_id, body.find === true);
  // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
    return json({ status: 'started', booking_id: body.booking_id }, 202);
  }
  return await work;
});

async function draft(supabaseUrl: string, supabaseServiceKey: string, booking_id: string, find: boolean): Promise<Response> {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.gogio.io';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let drafting = false;

  try {
    console.log('[generate-scorecard] Processing booking:', booking_id, find ? '(find in Fireflies)' : '');

    // Fetch full booking context (without FK join to profiles)
    const { data: booking, error: bookingError } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        job:jobs(id, title, description, organization_id, tenant_id, skills, skill_priorities, min_years_experience, max_years_experience, location, additional_locations, location_requirement, work_mode, salary_min, salary_max, salary_period, currency, budget_salary_min, budget_salary_max, budget_currency, budget_period),
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
      return json({ error: 'Booking not found' }, 404);
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
      return json({ status: 'skipped', reason: 'simple_booking_no_pipeline_context', booking_id });
    }

    const meta = (booking.transcript_metadata || {}) as Record<string, any>;
    if (!booking.transcript_raw && !meta.fireflies_id && !find) {
      console.error('[generate-scorecard] No transcript found for booking');
      return json({ error: 'No transcript available' }, 400);
    }

    console.log('[generate-scorecard] Booking loaded:', {
      candidate: booking.candidate?.candidate_name,
      job: booking.job?.title,
      stage: booking.job_hiring_stage?.stage?.stage_name,
      transcript_length: (booking.transcript_raw || '').length,
    });

    // Fetch scorecard questions for this stage if available
    let scorecardQuestions: QuestionForNotes[] = [];
    if (booking.job_hiring_stage?.id) {
      const { data: template } = await supabase
        .from('stage_scorecard_templates')
        .select(`
          id,
          questions:scorecard_interview_questions(
            id, question_text, answer_type, is_required, display_order, select_options, salary_config, retired_at
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

    // What arrived is cleaned when it's received (process-transcript-webhook); older rows
    // still hold the whole recap email, so clean them the same way here.
    let sourceKind: SourceKind = meta.source_kind === 'summary' || meta.source_kind === 'transcript' ? meta.source_kind : 'transcript';
    let sourceText: string = booking.transcript_raw || '';
    let provider = (meta.provider || (find ? 'fireflies' : 'other')) as 'fireflies' | 'read_ai' | 'other';
    let firefliesId: string | null = meta.fireflies_id ?? null;
    if (!meta.source_kind && booking.transcript_raw) {
      const cleaned = cleanInboundText(booking.transcript_raw, String(meta.from || ''));
      sourceText = cleaned.text;
      sourceKind = cleaned.kind;
      provider = cleaned.provider;
      firefliesId = cleaned.firefliesId;
    }
    if (!booking.transcript_raw) sourceKind = 'summary';

    // The whole conversation from Fireflies' API when there is one (step 3); with no
    // meeting id, Gio looks the interview up in Fireflies by time and the candidate's
    // email (step 4); otherwise the recap's summary, saying why.
    const candidateEmails = [booking.candidate_email, booking.candidate?.email].filter(Boolean) as string[];
    const source = await sourceForNotes(
      supabase,
      { id: booking.id, tenant_id: booking.tenant_id },
      { text: sourceText, kind: sourceKind, provider, firefliesId },
      {
        apiKey: Deno.env.get('FIREFLIES_API_KEY'),
        lookup: provider === 'fireflies' && booking.scheduled_start
          ? {
              start: booking.scheduled_start,
              end: booking.scheduled_end || booking.scheduled_start,
              emails: [...new Set(candidateEmails)],
              name: booking.candidate?.candidate_name || booking.candidate_name,
            }
          : null,
      },
    );
    if (!source.full && !source.text.trim()) {
      // Nothing reached Gio and Fireflies has nothing for this interview: no draft.
      await setStatus(supabase, booking_id, 'failed', source.reason || REASON.notFound);
      return json({ status: 'not_found', booking_id });
    }
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
    console.log('[generate-scorecard] Source kind:', sourceKind, 'full:', source.full, 'length:', transcriptContent.length, 'nothing said:', nothingSaid);

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
              ai_recommendation: null,
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

        return json({ status: 'empty_conversation', booking_id, scorecard_id: scorecardId, message: emptyMessage });
      }
    }
    // === END EMPTY CONVERSATION GUARD ===

    // What the recommendation is measured against: the job's own requirements.
    const job = booking.job || {};
    const criteria = jobCriteria(job);
    const band = payBand(job);

    const sourceNote = source.full
      ? `SOURCE: The full transcript of the call. Each line is one turn: "[m:ss] Speaker name: what they said", the time counted from the start of the call. ${interviewerName ? `${interviewerName} is the interviewer` : 'The interviewer works for the hiring team'}${candidateName ? `; ${candidateName} is the candidate` : ''}. The note-taker names speakers from the calendar, so someone may appear under another name or as "Speaker"; work out who is who from what they say. Quote exactly, and give the time of every quote (the "at" fields, m:ss).`
      : sourceKind === 'summary'
        ? `SOURCE: The note-taker's short written summary of the call, NOT a word-for-word transcript. Write only what it states: no quotes, no times, nothing filled in from the resume or the job description. Keep the notes as short as the summary allows, judge only the requirements it actually mentions, and list the rest in not_covered.`
        : `SOURCE: The interview as the note-taker sent it. Quote only words that appear in it.`;

    const systemPrompt = `You write interview notes for a hiring team: what the candidate said, measured against what this job needs. The interviewer always makes the decision; your recommendation must be accurate and rest only on the interview.

${sourceNote}

${NOTES_RULES}

If the source has no real interview in it (greetings, silence, people joining), judge every requirement not_discussed and give the rating not_enough.`;

    const jobContext = [
      `JOB: ${job.title || 'Position'}`,
      booking.job_hiring_stage?.stage?.stage_name ? `INTERVIEW STAGE: ${booking.job_hiring_stage.stage.stage_name}` : '',
      job.description ? `JOB DESCRIPTION:\n${plain(job.description).slice(0, 4000)}` : '',
      criteriaPrompt(criteria, job),
    ].filter(Boolean).join('\n\n');

    const candidateContext = booking.candidate
      ? `CANDIDATE (context only, never evidence): ${booking.candidate.candidate_name}${booking.candidate.role_current ? `, ${booking.candidate.role_current}` : ''}${booking.candidate.company_current ? ` at ${booking.candidate.company_current}` : ''}`
      : '';

    const userPrompt = [
      jobContext,
      candidateContext,
      questionsPrompt(scorecardQuestions),
      `INTERVIEW:\n${transcriptContent}`,
      'Submit the notes with submit_interview_notes.',
    ].filter(Boolean).join('\n\n');

    console.log('[generate-scorecard] Calling OpenAI, criteria:', criteria.length, 'questions:', scorecardQuestions.length);
    await setStatus(supabase, booking_id, 'drafting', source.reason);
    drafting = true;

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
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 12000,
        reasoning_effort: 'medium',
        tools: [notesTool(scorecardQuestions.length > 0)],
        tool_choice: { type: 'function', function: { name: 'submit_interview_notes' } },
      }),
    }, 'generate-scorecard-from-transcript', { timeoutMs: 180_000 });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-scorecard] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'submit_interview_notes') throw new Error('No notes came back from the model');
    let notes: ModelNotes;
    try {
      notes = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error('The notes that came back could not be read');
    }

    // Pay is the server's to judge: the stated figure on the band's own basis.
    const rates = await loadCurrencyRates(supabase as any, booking.tenant_id ?? job.tenant_id ?? null);
    const convert = (amount: number, fromC: string, fromP: string, toC: string, toP: string) =>
      normaliseSalary(amount, fromC, fromP, toC, toP, rates)?.amount ?? null;
    const stated = notes.stated_salary ?? null;
    const statedAmount = salaryAmount(stated);
    let payVerdict: Verdict | null = null;
    if (band && statedAmount != null) {
      const onBand = convert(statedAmount, String(stated?.currency || band.currency), String(stated?.period || band.period), band.currency, band.period);
      // An order of magnitude apart means the figures aren't on the same basis.
      const ref = Number(band.min ?? band.max ?? 0);
      if (onBand != null && !(ref > 0 && (onBand / ref > 10 || ref / onBand > 10))) payVerdict = salaryVerdict(onBand, band.min, band.max);
    }

    const language = languageCode(notes.language);
    const recommendation = settleRecommendation(notes.recommendation, notes.criteria, criteria, {
      full: source.full,
      sourceKind,
      language,
      salaryVerdict: payVerdict,
    });
    const generatedNotes = renderNotes(notes, recommendation, { full: source.full });
    const suggestedRating = recommendation.rating;
    const rows = answerRows(scorecardQuestions, notes.question_responses ?? [], stated, convert);

    if (!generatedNotes.trim()) throw new Error('No content generated from AI');
    console.log('[generate-scorecard] Notes written:', generatedNotes.length, 'chars, rating:', suggestedRating, 'confidence:', recommendation.confidence, 'answers:', rows.length);

    // Store summary in booking
    await supabase
      .from('scheduled_bookings')
      .update({ transcript_summary: generatedNotes })
      .eq('id', booking_id);

    // Check if a scorecard already exists for this interviewer/stage/candidate
    let scorecardId = null;
    let isDraft = false;

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
              ai_recommendation: recommendation,
              source_booking_id: booking_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingScorecard.id);

          if (!updateError) {
            scorecardId = existingScorecard.id;
            isDraft = true;
            console.log('[generate-scorecard] Updated existing draft scorecard:', scorecardId);
          } else {
            console.error('[generate-scorecard] Failed to update draft:', updateError);
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
            ai_recommendation: recommendation,
          })
          .select('id')
          .single();

        if (!insertError && newScorecard) {
          scorecardId = newScorecard.id;
          isDraft = true;
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

    // Gio's answers on a draft are replaced as a whole: an earlier draft's answers
    // (an old "[Not discussed]" text, a Yes in the wrong field) never linger.
    if (scorecardId && isDraft) {
      await supabase.from('scorecard_question_responses').delete().eq('scorecard_id', scorecardId);
      if (rows.length) {
        const { error: qrError } = await supabase
          .from('scorecard_question_responses')
          .insert(rows.map((r) => ({ scorecard_id: scorecardId, ...r })));
        if (qrError) console.error('[generate-scorecard] Failed to insert question responses:', qrError);
        else console.log('[generate-scorecard] Inserted', rows.length, 'question responses');
      }
    }

    // Send notification email to interviewer, once per booking.
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

    await setStatus(supabase, booking_id, 'drafted', source.reason, language ? { language } : {});
    drafting = false;

    return json({
      status: 'success',
      booking_id,
      scorecard_id: scorecardId,
      suggested_rating: suggestedRating,
      confidence: recommendation.confidence,
      notes_length: generatedNotes.length,
      questions_filled: rows.length,
    });

  } catch (error) {
    console.error('[generate-scorecard] Error:', error);
    if (drafting) await setStatus(supabase, booking_id, 'failed', REASON.failed);
    return json({ error: (error as Error).message }, 500);
  }
}
