import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Webhook } from "npm:svix@1.24.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// Extract candidate ingest code from email address
function extractCandidateIngestCode(email: string): string | null {
  // Format: jc_{code}@ingest.gogio.io
  const match = email.match(/^jc_([a-zA-Z0-9]{8})@ingest\.gogio\.io$/i);
  return match ? match[1] : null;
}

// Check if email is a calendar invite (should be ignored)
function isCalendarInvite(emailData: any): boolean {
  const subject = emailData.subject?.toLowerCase() || '';
  
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
  
  const attachments = emailData.attachments || [];
  const hasOnlyCalendarAttachments = attachments.length > 0 && attachments.every((a: any) => 
    a.content_type === 'text/calendar' || 
    a.content_type === 'application/ics' ||
    a.filename?.endsWith('.ics')
  );
  
  return hasCalendarSubject || hasOnlyCalendarAttachments;
}

// Extract ingest code from all recipients (to + cc + bcc)
function findCandidateIngestCodeInRecipients(emailData: any): { code: string | null; foundIn: string } {
  const checkAddresses = (addresses: any, label: string): { code: string | null; foundIn: string } => {
    const addrs = Array.isArray(addresses) ? addresses : [addresses].filter(Boolean);
    for (const addr of addrs) {
      const code = extractCandidateIngestCode(addr);
      if (code) {
        return { code, foundIn: `${label}:${addr}` };
      }
    }
    return { code: null, foundIn: '' };
  };
  
  // Check 'to' first
  let result = checkAddresses(emailData.to, 'to');
  if (result.code) return result;
  
  // Check 'cc'
  result = checkAddresses(emailData.cc, 'cc');
  if (result.code) return result;
  
  // Check 'bcc' (though unlikely to be in received emails)
  result = checkAddresses(emailData.bcc, 'bcc');
  if (result.code) return result;
  
  return { code: null, foundIn: '' };
}

// Extract References header for threading
function extractReferences(emailData: any): string | null {
  if (emailData.headers?.references) {
    return emailData.headers.references;
  }
  return null;
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
      console.error('[Candidate Reply Webhook] Missing signature headers');
      return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature
    let payload: any;
    try {
      const wh = new Webhook(webhookSecret);
      payload = wh.verify(rawPayload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature
      });
      console.log('[Candidate Reply Webhook] Signature verified');
    } catch (verifyError) {
      console.error('[Candidate Reply Webhook] Signature verification failed:', verifyError);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Candidate Reply Webhook] Received event:', payload.type);

    // Only process email.received events
    if (payload.type !== 'email.received') {
      console.log('[Candidate Reply Webhook] Ignoring non-email event:', payload.type);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not an email event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailData = payload.data;
    console.log('[Candidate Reply Webhook] Processing email:', {
      from: emailData.from,
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
    });

    // Ignore calendar invites
    if (isCalendarInvite(emailData)) {
      console.log('[Candidate Reply Webhook] Ignoring calendar invite:', emailData.subject);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'calendar_invite' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the candidate ingest email
    const { code: ingestCode, foundIn } = findCandidateIngestCodeInRecipients(emailData);

    if (!ingestCode) {
      // Not a candidate reply - could be a transcript or other ingest type
      console.log('[Candidate Reply Webhook] No jc_ ingest code found in recipients');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no_jc_ingest_code' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Candidate Reply Webhook] Found ingest code:', ingestCode, 'in:', foundIn);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up job_candidate_association by ingest code
    const { data: association, error: associationError } = await supabase
      .from('job_candidate_associations')
      .select(`
        id,
        candidate_id,
        job_id,
        candidate:candidates(id, candidate_name, email, organization_id, tenant_id),
        job:jobs(id, title, tenant_id, organization_id)
      `)
      .eq('email_ingest_code', ingestCode)
      .single();

    if (associationError || !association) {
      console.error('[Candidate Reply Webhook] Association not found for code:', ingestCode, associationError);
      return new Response(JSON.stringify({ error: 'Association not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidate = association.candidate;
    const job = association.job;

    console.log('[Candidate Reply Webhook] Found association:', {
      associationId: association.id,
      candidateId: association.candidate_id,
      candidateName: candidate?.candidate_name,
      jobId: association.job_id,
      jobTitle: job?.title,
    });

    // Get tenant and organization from job
    const tenantId = job?.tenant_id;
    const organizationId = job?.organization_id;

    if (!tenantId || !organizationId) {
      console.error('[Candidate Reply Webhook] Missing tenant or organization:', { tenantId, organizationId });
      return new Response(JSON.stringify({ error: 'Invalid association context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find a user_id to associate with this email log (use the first member of the org)
    const { data: orgMember } = await supabase
      .from('members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('user_status', 'active')
      .limit(1)
      .single();

    const userId = orgMember?.user_id;
    
    if (!userId) {
      console.error('[Candidate Reply Webhook] No active member found for org:', organizationId);
      return new Response(JSON.stringify({ error: 'No active org member found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for duplicates using message ID if available
    const messageId = emailData.message_id || emailData.headers?.['message-id'];
    if (messageId) {
      const { data: existing } = await supabase
        .from('email_logs')
        .select('id')
        .eq('rfc822_message_id', messageId)
        .single();
      
      if (existing) {
        console.log('[Candidate Reply Webhook] Duplicate email detected, skipping:', messageId);
        return new Response(JSON.stringify({ status: 'duplicate', existing_id: existing.id }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Store the received email
    const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to].filter(Boolean);
    const ccAddresses = Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc].filter(Boolean);

    const { data: emailLog, error: insertError } = await supabase
      .from('email_logs')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        organization_id: organizationId,
        direction: 'received',
        from_address: emailData.from,
        to_addresses: toAddresses,
        cc_addresses: ccAddresses,
        subject: emailData.subject || '(No Subject)',
        body_text: emailData.text || null,
        body_html: emailData.html || null,
        status: 'delivered',
        received_at: new Date().toISOString(),
        candidate_id: association.candidate_id,
        job_id: association.job_id,
        rfc822_message_id: messageId || null,
        references_header: extractReferences(emailData),
        snippet: emailData.text?.substring(0, 200) || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Candidate Reply Webhook] Failed to insert email log:', insertError);
      throw insertError;
    }

    console.log('[Candidate Reply Webhook] Email logged successfully:', emailLog.id);

    // Log to activity feed
    const activityTitle = `Reply received: ${emailData.subject || '(No Subject)'}`;
    const activityDescription = `${candidate?.candidate_name || 'Candidate'} replied to your email`;

    const { error: activityError } = await supabase.rpc('log_activity', {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_activity_type: 'candidate_email_received',
      p_title: activityTitle,
      p_description: activityDescription,
      p_metadata: {
        email_log_id: emailLog.id,
        from_address: emailData.from,
        subject: emailData.subject,
        candidate_name: candidate?.candidate_name,
        job_title: job?.title,
      },
      p_entity_type: 'candidate',
      p_entity_id: association.candidate_id,
    });

    if (activityError) {
      console.error('[Candidate Reply Webhook] Failed to log activity:', activityError);
      // Don't fail the webhook - email was stored successfully
    }

    return new Response(JSON.stringify({
      status: 'success',
      email_log_id: emailLog.id,
      candidate_id: association.candidate_id,
      job_id: association.job_id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Candidate Reply Webhook] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
