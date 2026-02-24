import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// Safely extract a string email address from various Resend formats
function parseEmailAddress(input: any): string {
  if (!input) return 'unknown@unknown.com';
  if (typeof input === 'string') {
    // Handle RFC 5322 format: "Name <email@example.com>"
    const match = input.match(/<([^>]+)>/);
    if (match) return match[1];
    return input.trim();
  }
  if (typeof input === 'object') {
    return input.address || input.email || input.value || JSON.stringify(input);
  }
  return String(input);
}

// Parse an array of addresses safely
function parseEmailAddresses(input: any): string[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list.map((addr: any) => parseEmailAddress(addr)).filter(Boolean);
}

// Verify Svix webhook signature manually
async function verifyWebhookSignature(
  payload: string,
  headers: { id: string; timestamp: string; signature: string },
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  
  const secretBytes = secret.startsWith('whsec_') 
    ? Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0))
    : encoder.encode(secret);
  
  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  
  const signatures = headers.signature.split(' ');
  
  for (const sig of signatures) {
    const [version, sigValue] = sig.split(',');
    if (version === 'v1' && sigValue === expectedSignature) {
      return true;
    }
  }
  
  return false;
}

// Extract candidate ingest code from email address
function extractCandidateIngestCode(email: string): string | null {
  const match = email.match(/^jc_([a-zA-Z0-9]{8})@ingest\.gogio\.io$/i);
  return match ? match[1] : null;
}

// Check if email is a calendar invite
function isCalendarInvite(emailData: any): boolean {
  const subject = emailData.subject?.toLowerCase() || '';
  
  const calendarPatterns = [
    'invitation:', 'updated invitation:', 'canceled:', 'cancelled:',
    'accepted:', 'declined:', 'tentative:', 'reminder:',
  ];
  
  if (calendarPatterns.some(p => subject.startsWith(p))) return true;
  
  const attachments = emailData.attachments || [];
  return attachments.length > 0 && attachments.every((a: any) => 
    a.content_type === 'text/calendar' || 
    a.content_type === 'application/ics' ||
    a.filename?.endsWith('.ics')
  );
}

// Find ingest code in ALL recipient fields (to, cc, bcc, envelope)
function findCandidateIngestCode(emailData: any): { code: string | null; foundIn: string } {
  const check = (addrs: any, label: string) => {
    const list = Array.isArray(addrs) ? addrs : [addrs].filter(Boolean);
    for (const addr of list) {
      const email = typeof addr === 'string' ? addr : addr?.address || addr?.email || '';
      const code = extractCandidateIngestCode(email);
      if (code) return { code, foundIn: `${label}:${email}` };
    }
    return null;
  };
  
  return (
    check(emailData.to, 'to') ||
    check(emailData.cc, 'cc') ||
    check(emailData.bcc, 'bcc') ||
    check(emailData.envelope_to, 'envelope_to') ||
    check(emailData.recipients, 'recipients') ||
    { code: null, foundIn: '' }
  );
}

// Look up the original sent email to establish threading
async function findOriginalThread(
  supabase: any,
  inReplyToHeader: string | null,
  referencesHeader: string | null,
  candidateId: string,
  jobId: string
): Promise<{ threadId: string | null; inReplyTo: string | null; references: string | null }> {
  try {
    // Strategy 1: Match by In-Reply-To header
    if (inReplyToHeader) {
      const cleanId = inReplyToHeader.replace(/[<>]/g, '').trim();
      
      const { data: byProvider } = await supabase
        .from('email_logs')
        .select('thread_id, provider_message_id, rfc822_message_id')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .or(`rfc822_message_id.eq.${cleanId},rfc822_message_id.eq.<${cleanId}>`)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      
      if (byProvider?.thread_id) {
        return {
          threadId: byProvider.thread_id,
          inReplyTo: cleanId,
          references: referencesHeader || cleanId,
        };
      }
    }

    // Strategy 2: Find the most recent sent email
    const { data: latestSent } = await supabase
      .from('email_logs')
      .select('thread_id, provider_message_id, rfc822_message_id')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .eq('direction', 'sent')
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestSent?.thread_id) {
      return {
        threadId: latestSent.thread_id,
        inReplyTo: latestSent.rfc822_message_id || latestSent.provider_message_id || null,
        references: referencesHeader || latestSent.rfc822_message_id || null,
      };
    }
  } catch (err) {
    console.error('[Candidate Reply] Threading lookup error:', err);
  }

  return { threadId: null, inReplyTo: null, references: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const webhookSecret = Deno.env.get('RESEND_CANDIDATE_REPLY_WEBHOOK_SECRET')!;

  try {
    const rawPayload = await req.text();
    
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('[Candidate Reply] Missing signature headers');
      return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyWebhookSignature(
      rawPayload,
      { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret
    );

    if (!isValid) {
      console.error('[Candidate Reply] Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawPayload);
    console.log('[Candidate Reply] Event:', payload.type);

    if (payload.type !== 'email.received') {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not email event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailData = payload.data;
    console.log('[Candidate Reply] From:', JSON.stringify(emailData.from), 'Subject:', emailData.subject);

    if (isCalendarInvite(emailData)) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'calendar' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code: ingestCode, foundIn } = findCandidateIngestCode(emailData);

    if (!ingestCode) {
      console.log('[Candidate Reply] No jc_ code found in any address field');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no_jc_code' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Candidate Reply] Ingest code:', ingestCode, 'found in:', foundIn);

    // Step 1: Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[Candidate Reply] Supabase client created');

    // Step 2: Look up association
    let association: any;
    try {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select(`
          id, candidate_id, job_id,
          candidate:candidates(id, candidate_name, email),
          job:jobs(id, title, tenant_id, organization_id)
        `)
        .eq('email_ingest_code', ingestCode)
        .single();

      if (error || !data) {
        console.log('[Candidate Reply] Association not found for code:', ingestCode, error ? JSON.stringify(error) : '');
        return new Response(JSON.stringify({ status: 'ignored', reason: 'unmatched_token', code: ingestCode }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      association = data;
      console.log('[Candidate Reply] Association found:', association.id, 'candidate:', association.candidate_id, 'job:', association.job_id);
    } catch (err: any) {
      console.error('[Candidate Reply] Association lookup crashed:', err?.message || err);
      return new Response(JSON.stringify({ error: 'Association lookup crashed', detail: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const job = association.job as any;
    const candidate = association.candidate as any;
    const tenantId = job?.tenant_id;
    const orgId = job?.organization_id;

    console.log('[Candidate Reply] tenant_id:', tenantId, 'org_id:', orgId);

    if (!tenantId) {
      console.error('[Candidate Reply] Missing tenant_id. Job data:', JSON.stringify(job));
      return new Response(JSON.stringify({ status: 'ignored', reason: 'missing_tenant_id' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Duplicate check
    const messageId = emailData.message_id || emailData.headers?.['message-id'];
    if (messageId) {
      try {
        const { data: existing } = await supabase
          .from('email_logs')
          .select('id')
          .eq('rfc822_message_id', messageId)
          .maybeSingle();
        
        if (existing) {
          console.log('[Candidate Reply] Duplicate message:', messageId);
          return new Response(JSON.stringify({ status: 'duplicate' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (err: any) {
        console.error('[Candidate Reply] Duplicate check error (continuing):', err?.message || err);
      }
    }
    console.log('[Candidate Reply] No duplicate found, messageId:', messageId);

    // Step 5: Threading
    const incomingHeaders = emailData.headers || {};
    const inReplyToHeader = incomingHeaders['in-reply-to'] || incomingHeaders['In-Reply-To'] || null;
    const referencesHeader = incomingHeaders['references'] || incomingHeaders['References'] || null;

    const threading = await findOriginalThread(
      supabase,
      inReplyToHeader,
      referencesHeader,
      association.candidate_id,
      association.job_id
    );

    console.log('[Candidate Reply] Threading:', JSON.stringify({
      threadId: threading.threadId,
      inReplyTo: threading.inReplyTo,
      hasReferences: !!threading.references,
    }));

    // Step 6: Parse addresses safely
    const parsedFrom = parseEmailAddress(emailData.from);
    const toAddrs = parseEmailAddresses(emailData.to);
    const ccAddrs = parseEmailAddresses(emailData.cc);

    console.log('[Candidate Reply] Parsed from:', parsedFrom, 'to:', toAddrs.length, 'cc:', ccAddrs.length);

    // Step 6b: Filter out internal sender copies (self-sent BCC echoes)
    const parsedFromLower = parsedFrom.toLowerCase();
    try {
      const { data: internalSender } = await supabase
        .from('user_mail_identities')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('email_address', parsedFromLower)
        .maybeSingle();

      if (internalSender) {
        console.log('[Candidate Reply] Ignoring internal sender copy from:', parsedFrom);
        return new Response(JSON.stringify({ status: 'ignored', reason: 'internal_sender_copy' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (err: any) {
      console.error('[Candidate Reply] Internal sender check error (continuing):', err?.message || err);
    }

    // Step 6c: Fetch full email content from Resend receiving API with retry
    let bodyHtml: string | null = null;
    let bodyText: string | null = null;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey && emailData.email_id) {
      const delays = [0, 500, 1500]; // retry delays in ms
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) {
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
        try {
          const emailRes = await fetch(
            `https://api.resend.com/emails/receiving/${emailData.email_id}`,
            { headers: { Authorization: `Bearer ${resendApiKey}` } }
          );
          if (emailRes.ok) {
            const fullEmail = await emailRes.json();
            bodyHtml = fullEmail.html || null;
            bodyText = fullEmail.text || null;
            console.log(`[Candidate Reply] Fetched email body (attempt ${attempt + 1}):`,
              bodyHtml ? `html=${bodyHtml.length}chars` : 'no html',
              bodyText ? `text=${bodyText.length}chars` : 'no text');
            break; // success
          } else {
            const errText = await emailRes.text();
            console.error(`[Candidate Reply] Resend receiving API error (attempt ${attempt + 1}/${delays.length}):`,
              emailRes.status, errText, 'email_id:', emailData.email_id);
            if (emailRes.status !== 404 || attempt === delays.length - 1) {
              break; // only retry on 404 (not yet indexed)
            }
          }
        } catch (err) {
          console.error(`[Candidate Reply] Failed to fetch email body (attempt ${attempt + 1}):`, err);
          if (attempt === delays.length - 1) break;
        }
      }
    }

    // Step 7: Insert email log
    let emailLog: any;
    try {
      const insertPayload = {
        user_id: null,
        tenant_id: tenantId,
        organization_id: orgId,
        direction: 'received',
        from_address: parsedFrom,
        to_addresses: toAddrs,
        cc_addresses: ccAddrs,
        subject: emailData.subject || '(No Subject)',
        body_text: bodyText || emailData.text || null,
        body_html: bodyHtml || emailData.html || null,
        status: 'delivered',
        received_at: new Date().toISOString(),
        candidate_id: association.candidate_id,
        job_id: association.job_id,
        rfc822_message_id: messageId || null,
        snippet: (bodyText || emailData.text)?.substring(0, 200) || null,
        thread_id: threading.threadId || null,
        in_reply_to: threading.inReplyTo || null,
        references_header: threading.references || null,
      };

      console.log('[Candidate Reply] Insert payload keys:', Object.keys(insertPayload).join(', '));

      const { data, error: insertErr } = await supabase
        .from('email_logs')
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) {
        console.error('[Candidate Reply] INSERT ERROR:', JSON.stringify(insertErr));
        console.error('[Candidate Reply] Insert payload:', JSON.stringify(insertPayload));
        return new Response(JSON.stringify({ error: 'Insert failed', detail: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      emailLog = data;
      console.log('[Candidate Reply] Successfully logged email:', emailLog.id, 'thread:', threading.threadId);
    } catch (err: any) {
      console.error('[Candidate Reply] Insert crashed:', err?.message || err);
      return new Response(JSON.stringify({ error: 'Insert crashed', detail: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 8: Activity logging skipped - no user_id for inbound webhook emails
    console.log('[Candidate Reply] Skipping activity log (no user_id for inbound)');

    return new Response(JSON.stringify({ status: 'success', email_log_id: emailLog.id, thread_id: threading.threadId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Candidate Reply] Top-level error:', error?.message || error);
    console.error('[Candidate Reply] Stack:', error?.stack || 'no stack');
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
