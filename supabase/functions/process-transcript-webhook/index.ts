import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Webhook } from "npm:svix@1.24.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// Extract ingest code from email address
function extractIngestCode(email: string): string | null {
  // Format: int_{code}@ingest.gogio.io
  const match = email.match(/^int_([a-zA-Z0-9]{8})@ingest\.gogio\.io$/i);
  return match ? match[1] : null;
}

// Check if email is a calendar invite (should be ignored)
function isCalendarInvite(emailData: any): boolean {
  const subject = emailData.subject?.toLowerCase() || '';
  
  // Calendar invite subject patterns
  const calendarSubjectPatterns = [
    'invitation:',
    'updated invitation:',
    'canceled:',
    'cancelled:',
    'accepted:',
    'declined:',
    'tentative:',
    'reminder:',
  ];
  
  const hasCalendarSubject = calendarSubjectPatterns.some(pattern => 
    subject.startsWith(pattern)
  );
  
  // Check attachments for calendar-only content
  const attachments = emailData.attachments || [];
  const hasOnlyCalendarAttachments = attachments.length > 0 && attachments.every((a: any) => 
    a.content_type === 'text/calendar' || 
    a.content_type === 'application/ics' ||
    a.filename?.endsWith('.ics')
  );
  
  // It's a calendar invite if it has a calendar subject OR only calendar attachments
  return hasCalendarSubject || hasOnlyCalendarAttachments;
}

// Extract ingest code from all recipients (to + cc)
function findIngestCodeInRecipients(emailData: any): { code: string | null; foundIn: string } {
  // Check 'to' addresses first
  const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to].filter(Boolean);
  for (const addr of toAddresses) {
    const code = extractIngestCode(addr);
    if (code) {
      return { code, foundIn: `to:${addr}` };
    }
  }
  
  // Check 'cc' addresses
  const ccAddresses = Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc].filter(Boolean);
  for (const addr of ccAddresses) {
    const code = extractIngestCode(addr);
    if (code) {
      return { code, foundIn: `cc:${addr}` };
    }
  }
  
  return { code: null, foundIn: '' };
}

// Extract text from PDF bytes using unpdf (Deno-friendly, no fs side effects)
async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(pdfBytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const out = Array.isArray(text) ? text.join('\n') : (text || '');
    return (typeof out === 'string' ? out : String(out)).trim();
  } catch (err) {
    console.error('[Transcript Webhook] unpdf extraction error:', err);
    return '';
  }
}

// OCR fallback for image-only PDFs using GPT-4o vision
async function ocrPdfWithVision(pdfBytes: Uint8Array, openaiApiKey: string): Promise<string> {
  try {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(pdfBytes.subarray(i, i + chunkSize)));
    }
    const base64Pdf = btoa(binary);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Extract ALL text from this interview transcript PDF. Return only the raw extracted text, preserving speaker labels and structure. No commentary.' },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
          ],
        }],
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      console.error('[Transcript Webhook] OCR vision API error:', res.status, await res.text());
      return '';
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.error('[Transcript Webhook] OCR vision error:', err);
    return '';
  }
}

// Fetch a single attachment's bytes from Resend receiving API
async function fetchAttachmentBytesFromResend(
  emailId: string,
  attachmentId: string,
  resendApiKey: string,
): Promise<{ bytes: Uint8Array | null; content_type?: string; filename?: string }> {
  try {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${resendApiKey}` } },
    );
    if (!res.ok) {
      console.error(`[Transcript Webhook] Resend attachment fetch ${res.status}: ${await res.text()}`);
      return { bytes: null };
    }
    const data = await res.json();
    if (!data.content) return { bytes: null, content_type: data.content_type, filename: data.filename };
    const bytes = Uint8Array.from(atob(data.content), (c: string) => c.charCodeAt(0));
    return { bytes, content_type: data.content_type, filename: data.filename };
  } catch (err) {
    console.error('[Transcript Webhook] Resend attachment fetch error:', err);
    return { bytes: null };
  }
}

// Extract transcript content from email
async function extractTranscriptContent(
  emailData: any,
  opts?: { resendApiKey?: string; openaiApiKey?: string },
): Promise<{ content: string; metadata: any }> {
  let content = '';
  const metadata: any = {
    from: emailData.from,
    subject: emailData.subject,
    received_at: new Date().toISOString(),
  };

  // Try to get content from text body first (preferred for transcripts)
  if (emailData.text) {
    content = emailData.text;
    metadata.content_source = 'text_body';
  } else if (emailData.html) {
    content = emailData.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    metadata.content_source = 'html_body';
  }

  // Check for attachments
  if (emailData.attachments && emailData.attachments.length > 0) {
    metadata.attachments = emailData.attachments.map((a: any) => ({
      filename: a.filename,
      content_type: a.content_type,
      size: a.size,
      has_inline_content: !!a.content,
      id: a.id,
    }));
    console.log('[Transcript Webhook] Attachments:', JSON.stringify(metadata.attachments));

    for (const attachment of emailData.attachments) {
      if (attachment.content_type === 'text/calendar' ||
          attachment.content_type === 'application/ics' ||
          attachment.filename?.endsWith('.ics')) {
        continue;
      }

      // Handle PDF attachments
      if (attachment.content_type === 'application/pdf' ||
          attachment.filename?.endsWith('.pdf')) {
        try {
          let pdfBytes: Uint8Array | null = null;

          if (attachment.content) {
            pdfBytes = Uint8Array.from(atob(attachment.content), (c: string) => c.charCodeAt(0));
          } else if (emailData.email_id && attachment.id && opts?.resendApiKey) {
            console.log(`[Transcript Webhook] Fetching attachment "${attachment.filename}" bytes from Resend receiving API...`);
            const fetched = await fetchAttachmentBytesFromResend(
              emailData.email_id,
              attachment.id,
              opts.resendApiKey,
            );
            pdfBytes = fetched.bytes;
          } else {
            console.warn('[Transcript Webhook] PDF attachment missing inline content and no email_id/attachment_id to fetch:', attachment.filename);
            continue;
          }

          if (!pdfBytes) {
            console.warn('[Transcript Webhook] No PDF bytes available for:', attachment.filename);
            continue;
          }

          let pdfText = await extractTextFromPdfBytes(pdfBytes);
          console.log('[Transcript Webhook] Extracted PDF text via unpdf, length:', pdfText.length);

          // OCR fallback for image-only PDFs
          if (pdfText.length < 100 && opts?.openaiApiKey) {
            console.log('[Transcript Webhook] PDF text < 100 chars, attempting OCR vision fallback...');
            const ocrText = await ocrPdfWithVision(pdfBytes, opts.openaiApiKey);
            console.log('[Transcript Webhook] OCR vision text length:', ocrText.length);
            if (ocrText.length > pdfText.length) {
              pdfText = ocrText;
              metadata.ocr_used = true;
            }
          }

          if (pdfText.length > content.length) {
            content = pdfText;
            metadata.content_source = `attachment:${attachment.filename}`;
          }
        } catch (e) {
          console.error('[Transcript Webhook] Failed to parse PDF attachment:', attachment.filename, e);
          metadata.pdf_parse_error = String(e);
        }
        continue;
      }

      if (attachment.content_type?.includes('text') ||
          attachment.filename?.endsWith('.txt') ||
          attachment.filename?.endsWith('.vtt') ||
          attachment.filename?.endsWith('.srt')) {
        try {
          let txtContent = '';
          if (attachment.content) {
            txtContent = atob(attachment.content);
          } else if (emailData.email_id && attachment.id && opts?.resendApiKey) {
            const fetched = await fetchAttachmentBytesFromResend(
              emailData.email_id,
              attachment.id,
              opts.resendApiKey,
            );
            if (fetched.bytes) txtContent = new TextDecoder().decode(fetched.bytes);
          }
          if (txtContent.length > content.length) {
            content = txtContent;
            metadata.content_source = `attachment:${attachment.filename}`;
          }
        } catch (e) {
          console.warn('[Transcript Webhook] Failed to decode attachment:', e);
        }
      }
    }
  }

  return { content, metadata };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const webhookSecret = Deno.env.get('RESEND_INBOUND_WEBHOOK_SECRET')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

  try {
    // Get raw payload for signature verification
    const rawPayload = await req.text();
    
    // Get Svix headers (optional - Resend inbound webhooks may not include them)
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    let payload: any;

    if (svixId && svixTimestamp && svixSignature) {
      // Svix headers present → verify signature
      try {
        const wh = new Webhook(webhookSecret);
        payload = wh.verify(rawPayload, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature
        });
        console.log('[Transcript Webhook] Signature verified successfully');
      } catch (verifyError) {
        console.error('[Transcript Webhook] Signature verification failed:', verifyError);
        return new Response(JSON.stringify({ error: 'Invalid signature', details: String(verifyError) }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // No Svix headers → parse payload directly, rely on ingest code validation
      console.warn('[Transcript Webhook] No Svix signature headers present - skipping signature verification');
      try {
        payload = JSON.parse(rawPayload);
      } catch (parseError) {
        console.error('[Transcript Webhook] Failed to parse payload:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('[Transcript Webhook] Received event:', payload.type);

    // Only process email.received events
    if (payload.type !== 'email.received') {
      console.log('[Transcript Webhook] Ignoring non-email event:', payload.type);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not an email event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailData = payload.data;
    console.log('[Transcript Webhook] Processing email:', {
      from: emailData.from,
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
      attachments: emailData.attachments?.map((a: any) => ({ 
        filename: a.filename, 
        content_type: a.content_type 
      })),
    });

    // Check if this is a calendar invite (should be ignored, not rejected)
    if (isCalendarInvite(emailData)) {
      console.log('[Transcript Webhook] Ignoring calendar invite:', emailData.subject);
      return new Response(JSON.stringify({ 
        status: 'ignored', 
        reason: 'calendar_invite',
        subject: emailData.subject,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the ingest email in both to and cc recipients
    const { code: ingestCode, foundIn } = findIngestCodeInRecipients(emailData);

    if (!ingestCode) {
      console.error('[Transcript Webhook] No valid ingest code found in recipients:', {
        to: emailData.to,
        cc: emailData.cc,
      });
      return new Response(JSON.stringify({ error: 'Invalid recipient email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Transcript Webhook] Found ingest code:', ingestCode, 'in:', foundIn);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up booking by ingest code (without FK join to profiles)
    const { data: booking, error: bookingError } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        job:jobs(id, title, description),
        candidate:candidates(id, candidate_name, email, profile_summary, resume_url),
        job_hiring_stage:job_hiring_stages(
          id,
          stage:job_stages(id, stage_name)
        )
      `)
      .eq('transcript_ingest_code', ingestCode)
      .single();

    if (bookingError || !booking) {
      console.error('[Transcript Webhook] Booking not found for code:', ingestCode, bookingError);
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch interviewer separately (no FK constraint exists)
    let interviewer = null;
    if (booking.interviewer_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .eq('user_id', booking.interviewer_id)
        .single();
      interviewer = profileData;
    }

    console.log('[Transcript Webhook] Found booking:', booking.id, 'for candidate:', booking.candidate?.candidate_name);

    // Check if this is a simple booking (no pipeline context) - skip AI processing
    if (!booking.candidate_id || !booking.job_hiring_stage_id) {
      console.log('[Transcript Webhook] Simple booking detected - skipping AI processing');
      return new Response(JSON.stringify({ 
        status: 'skipped', 
        reason: 'simple_booking_no_pipeline_context',
        booking_id: booking.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract transcript content
    let { content, metadata } = await extractTranscriptContent(emailData);

    // If no content from webhook payload, fetch from Resend receiving API
    if ((!content || content.trim().length < 100) && emailData.email_id && resendApiKey) {
      console.log('[Transcript Webhook] No content in payload, fetching from Resend receiving API, email_id:', emailData.email_id);
      const delays = [0, 500, 1500];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
        try {
          const res = await fetch(`https://api.resend.com/emails/receiving/${emailData.email_id}`, {
            headers: { Authorization: `Bearer ${resendApiKey}` },
          });
          if (res.ok) {
            const fullEmail = await res.json();
            console.log(`[Transcript Webhook] Resend fetch OK (attempt ${attempt + 1}): text=${fullEmail.text?.length || 0} html=${fullEmail.html?.length || 0}`);
            const enriched = await extractTranscriptContent({
              ...emailData,
              text: fullEmail.text || emailData.text,
              html: fullEmail.html || emailData.html,
              attachments: fullEmail.attachments || emailData.attachments,
            });
            content = enriched.content;
            metadata = { ...enriched.metadata, resend_fetch: true, resend_attempt: attempt + 1 };
            break;
          }
          const errText = await res.text();
          console.error(`[Transcript Webhook] Resend API ${res.status} (attempt ${attempt + 1}/${delays.length}): ${errText}`);
          if (res.status !== 404) break;
        } catch (err) {
          console.error(`[Transcript Webhook] Resend fetch error (attempt ${attempt + 1}):`, err);
        }
      }
    }

    if (!content || content.trim().length < 100) {
      console.warn('[Transcript Webhook] Transcript content too short:', {
        received_length: content?.length || 0,
        from: emailData.from,
        subject: emailData.subject,
      });
      return new Response(JSON.stringify({ 
        error: 'Transcript content too short',
        received_length: content?.length || 0 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Transcript Webhook] Extracted transcript, length:', content.length, 'source:', metadata.content_source);

    // Store raw transcript
    const { error: updateError } = await supabase
      .from('scheduled_bookings')
      .update({
        transcript_raw: content,
        transcript_metadata: metadata,
        transcript_received_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('[Transcript Webhook] Failed to store transcript:', updateError);
      throw updateError;
    }

    console.log('[Transcript Webhook] Transcript stored, triggering scorecard generation...');

    // Trigger scorecard generation (async call)
    const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-scorecard-from-transcript`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        booking_id: booking.id,
      }),
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('[Transcript Webhook] Scorecard generation failed:', errorText);
      // Don't fail the webhook - transcript is stored, generation can be retried
    } else {
      console.log('[Transcript Webhook] Scorecard generation triggered successfully');
    }

    return new Response(JSON.stringify({ 
      status: 'success',
      booking_id: booking.id,
      transcript_length: content.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-transcript-webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
