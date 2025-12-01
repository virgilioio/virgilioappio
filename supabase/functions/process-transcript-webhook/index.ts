import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Webhook } from "npm:svix@1.24.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// Extract ingest code from email address
function extractIngestCode(email: string): string | null {
  // Format: int_{code}@ingest.virgilio.io
  const match = email.match(/^int_([a-zA-Z0-9]{8})@ingest\.virgilio\.io$/i);
  return match ? match[1] : null;
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

    // Look for text attachments
    for (const attachment of emailData.attachments) {
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
          console.warn('[process-transcript-webhook] Failed to decode attachment:', e);
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
    
    // Get Svix headers
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('[process-transcript-webhook] Missing signature headers:', {
        hasId: !!svixId,
        hasTimestamp: !!svixTimestamp,
        hasSignature: !!svixSignature
      });
      return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature using official Svix SDK
    let payload: any;
    try {
      const wh = new Webhook(webhookSecret);
      payload = wh.verify(rawPayload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature
      });
      console.log('[process-transcript-webhook] Signature verified successfully');
    } catch (verifyError) {
      console.error('[process-transcript-webhook] Signature verification failed:', verifyError);
      return new Response(JSON.stringify({ error: 'Invalid signature', details: String(verifyError) }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[process-transcript-webhook] Received webhook event:', payload.type);

    // Only process email.received events
    if (payload.type !== 'email.received') {
      console.log('[process-transcript-webhook] Ignoring non-email event:', payload.type);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not an email event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailData = payload.data;
    console.log('[process-transcript-webhook] Processing email from:', emailData.from, 'to:', emailData.to);

    // Find the ingest email in the recipients
    let ingestCode: string | null = null;
    const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    
    for (const toAddr of toAddresses) {
      const code = extractIngestCode(toAddr);
      if (code) {
        ingestCode = code;
        break;
      }
    }

    if (!ingestCode) {
      console.error('[process-transcript-webhook] No valid ingest code found in recipients:', toAddresses);
      return new Response(JSON.stringify({ error: 'Invalid recipient email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[process-transcript-webhook] Extracted ingest code:', ingestCode);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up booking by ingest code
    const { data: booking, error: bookingError } = await supabase
      .from('scheduled_bookings')
      .select(`
        *,
        job:jobs(id, title, description),
        candidate:candidates(id, candidate_name, email, profile_summary, resume_url),
        job_hiring_stage:job_hiring_stages(
          id,
          stage:job_stages(id, stage_name)
        ),
        interviewer:profiles!scheduled_bookings_interviewer_id_fkey(user_id, first_name, last_name, email)
      `)
      .eq('transcript_ingest_code', ingestCode)
      .single();

    if (bookingError || !booking) {
      console.error('[process-transcript-webhook] Booking not found for code:', ingestCode, bookingError);
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[process-transcript-webhook] Found booking:', booking.id, 'for candidate:', booking.candidate?.candidate_name);

    // Extract transcript content
    const { content, metadata } = extractTranscriptContent(emailData);

    if (!content || content.trim().length < 100) {
      console.warn('[process-transcript-webhook] Transcript content too short or empty');
      return new Response(JSON.stringify({ 
        error: 'Transcript content too short',
        received_length: content?.length || 0 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[process-transcript-webhook] Extracted transcript, length:', content.length);

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
      console.error('[process-transcript-webhook] Failed to store transcript:', updateError);
      throw updateError;
    }

    console.log('[process-transcript-webhook] Transcript stored, triggering scorecard generation...');

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
      console.error('[process-transcript-webhook] Scorecard generation failed:', errorText);
      // Don't fail the webhook - transcript is stored, generation can be retried
    } else {
      console.log('[process-transcript-webhook] Scorecard generation triggered successfully');
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
