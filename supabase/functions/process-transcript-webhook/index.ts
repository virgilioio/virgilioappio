import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Webhook } from "npm:svix@1.24.0";

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

// Extract transcript content from email
function extractTranscriptContent(emailData: any): { content: string; metadata: any } {
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
    // Strip HTML tags for plain text
    content = emailData.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    metadata.content_source = 'html_body';
  }

  // Check for attachments (some note-takers send transcript as attachment)
  if (emailData.attachments && emailData.attachments.length > 0) {
    metadata.attachments = emailData.attachments.map((a: any) => ({
      filename: a.filename,
      content_type: a.content_type,
      size: a.size,
    }));

    // Look for text attachments (skip calendar files)
    for (const attachment of emailData.attachments) {
      // Skip calendar attachments
      if (attachment.content_type === 'text/calendar' || 
          attachment.content_type === 'application/ics' ||
          attachment.filename?.endsWith('.ics')) {
        continue;
      }
      
      if (attachment.content_type?.includes('text') || 
          attachment.filename?.endsWith('.txt') ||
          attachment.filename?.endsWith('.vtt') ||
          attachment.filename?.endsWith('.srt')) {
        try {
          const attachmentContent = atob(attachment.content);
          if (attachmentContent.length > content.length) {
            content = attachmentContent;
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
    const { content, metadata } = extractTranscriptContent(emailData);

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
