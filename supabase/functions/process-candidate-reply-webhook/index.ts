import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const WEBHOOK_VERSION = "candidate-reply-v4-2026-02-24";
const MAX_BODY_CHARS = 200_000; // ~200KB cap

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// ── Utility helpers ──────────────────────────────────────────────────

function parseEmailAddress(input: any): string {
  if (!input) return 'unknown@unknown.com';
  if (typeof input === 'string') {
    const match = input.match(/<([^>]+)>/);
    if (match) return match[1];
    return input.trim();
  }
  if (typeof input === 'object') {
    return input.address || input.email || input.value || JSON.stringify(input);
  }
  return String(input);
}

function parseEmailAddresses(input: any): string[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list.map((addr: any) => parseEmailAddress(addr)).filter(Boolean);
}

function limitSize(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|tr|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildSnippet(text: string | null, html: string | null, maxLen = 120): string | null {
  const source = text || (html ? stripHtmlToText(html) : null);
  if (!source) return null;
  const cleaned = source.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}

/** Extract body from any shape of payload (webhook data or Resend API response) */
function extractBody(source: any): { text: string | null; html: string | null } {
  if (!source || typeof source !== 'object') return { text: null, html: null };

  // Check nested data wrapper
  const obj = source.data && typeof source.data === 'object' ? source.data : source;

  const textCandidates = ['text', 'body_text', 'body', 'content', 'raw'];
  const htmlCandidates = ['html', 'body_html'];

  let text: string | null = null;
  let html: string | null = null;

  for (const key of textCandidates) {
    if (obj[key] && typeof obj[key] === 'string' && obj[key].trim()) {
      text = obj[key];
      break;
    }
  }
  for (const key of htmlCandidates) {
    if (obj[key] && typeof obj[key] === 'string' && obj[key].trim()) {
      html = obj[key];
      break;
    }
  }

  return {
    text: limitSize(text, MAX_BODY_CHARS),
    html: limitSize(html, MAX_BODY_CHARS),
  };
}

// ── Signature verification ───────────────────────────────────────────

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
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  for (const sig of headers.signature.split(' ')) {
    const [version, sigValue] = sig.split(',');
    if (version === 'v1' && sigValue === expectedSignature) return true;
  }
  return false;
}

// ── Ingest code helpers ──────────────────────────────────────────────

function extractCandidateIngestCode(email: string): string | null {
  const match = email.match(/^jc_([a-zA-Z0-9]{8})@ingest\.gogio\.io$/i);
  return match ? match[1] : null;
}

function isCalendarInvite(emailData: any): boolean {
  const subject = emailData.subject?.toLowerCase() || '';
  const calendarPatterns = ['invitation:', 'updated invitation:', 'canceled:', 'cancelled:', 'accepted:', 'declined:', 'tentative:', 'reminder:'];
  if (calendarPatterns.some(p => subject.startsWith(p))) return true;
  const attachments = emailData.attachments || [];
  return attachments.length > 0 && attachments.every((a: any) =>
    a.content_type === 'text/calendar' || a.content_type === 'application/ics' || a.filename?.endsWith('.ics')
  );
}

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

// ── Threading ────────────────────────────────────────────────────────

async function findOriginalThread(
  supabase: any,
  inReplyToHeader: string | null,
  referencesHeader: string | null,
  candidateId: string,
  jobId: string
): Promise<{ threadId: string | null; inReplyTo: string | null; references: string | null }> {
  try {
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
        return { threadId: byProvider.thread_id, inReplyTo: cleanId, references: referencesHeader || cleanId };
      }
    }
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
      return { threadId: latestSent.thread_id, inReplyTo: latestSent.rfc822_message_id || latestSent.provider_message_id || null, references: referencesHeader || latestSent.rfc822_message_id || null };
    }
  } catch (err) {
    console.error(`[${WEBHOOK_VERSION}] Threading lookup error:`, err);
  }
  return { threadId: null, inReplyTo: null, references: null };
}

// ── Fetch body from Resend receiving API ─────────────────────────────

async function fetchBodyFromResend(emailId: string, apiKey: string): Promise<{ text: string | null; html: string | null }> {
  const delays = [0, 500, 1500];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const body = extractBody(data);
        console.log(`[${WEBHOOK_VERSION}] Resend receiving fetch OK (attempt ${attempt + 1}): text=${body.text?.length || 0} html=${body.html?.length || 0}`);
        return body;
      }
      const errText = await res.text();
      console.error(`[${WEBHOOK_VERSION}] Resend receiving API ${res.status} (attempt ${attempt + 1}/${delays.length}): ${errText} email_id=${emailId}`);
      // Only retry on 404 (not yet indexed)
      if (res.status !== 404) break;
    } catch (err) {
      console.error(`[${WEBHOOK_VERSION}] Resend fetch error (attempt ${attempt + 1}):`, err);
    }
  }
  return { text: null, html: null };
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const webhookSecret = Deno.env.get('RESEND_CANDIDATE_REPLY_WEBHOOK_SECRET')!;

  try {
    const rawPayload = await req.text();
    console.log(`[${WEBHOOK_VERSION}] Received webhook`);

    // Verify signature
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error(`[${WEBHOOK_VERSION}] Missing signature headers`);
      return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyWebhookSignature(rawPayload, { id: svixId, timestamp: svixTimestamp, signature: svixSignature }, webhookSecret);
    if (!isValid) {
      console.error(`[${WEBHOOK_VERSION}] Invalid signature`);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawPayload);
    console.log(`[${WEBHOOK_VERSION}] Event: ${payload.type}`);

    if (payload.type !== 'email.received') {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not email event' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailData = payload.data;
    console.log(`[${WEBHOOK_VERSION}] From: ${JSON.stringify(emailData.from)} Subject: ${emailData.subject}`);

    if (isCalendarInvite(emailData)) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'calendar' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code: ingestCode, foundIn } = findCandidateIngestCode(emailData);
    if (!ingestCode) {
      console.log(`[${WEBHOOK_VERSION}] No jc_ code found`);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no_jc_code' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[${WEBHOOK_VERSION}] Ingest code: ${ingestCode} found in: ${foundIn}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up association
    const { data: association, error: assocErr } = await supabase
      .from('job_candidate_associations')
      .select(`id, candidate_id, job_id, candidate:candidates(id, candidate_name, email), job:jobs(id, title, tenant_id, organization_id)`)
      .eq('email_ingest_code', ingestCode)
      .single();

    if (assocErr || !association) {
      console.log(`[${WEBHOOK_VERSION}] Association not found for code: ${ingestCode}`);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'unmatched_token', code: ingestCode }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const job = association.job as any;
    const tenantId = job?.tenant_id;
    const orgId = job?.organization_id;

    if (!tenantId) {
      console.error(`[${WEBHOOK_VERSION}] Missing tenant_id`);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'missing_tenant_id' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse sender & filter internal copies
    const parsedFrom = parseEmailAddress(emailData.from);
    const parsedFromLower = parsedFrom.toLowerCase();

    try {
      const { data: internalSender } = await supabase
        .from('user_mail_identities')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('email_address', parsedFromLower)
        .maybeSingle();
      if (internalSender) {
        console.log(`[${WEBHOOK_VERSION}] Ignoring internal sender copy from: ${parsedFrom}`);
        return new Response(JSON.stringify({ status: 'ignored', reason: 'internal_sender_copy' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (err: any) {
      console.error(`[${WEBHOOK_VERSION}] Internal sender check error (continuing):`, err?.message);
    }

    // ── Extract body: payload first, then Resend API ──
    let { text: bodyText, html: bodyHtml } = extractBody(emailData);
    console.log(`[${WEBHOOK_VERSION}] Payload body: text=${bodyText?.length || 0} html=${bodyHtml?.length || 0}`);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if ((!bodyText && !bodyHtml) && resendApiKey && emailData.email_id) {
      console.log(`[${WEBHOOK_VERSION}] Body missing from payload, fetching from Resend receiving API: ${emailData.email_id}`);
      const fetched = await fetchBodyFromResend(emailData.email_id, resendApiKey);
      bodyText = fetched.text;
      bodyHtml = fetched.html;
    } else if (!bodyText && !bodyHtml && !emailData.email_id) {
      console.log(`[${WEBHOOK_VERSION}] No body in payload and no email_id to fetch from Resend`);
    }

    const snippet = buildSnippet(bodyText, bodyHtml);
    console.log(`[${WEBHOOK_VERSION}] Final body: text=${bodyText?.length || 0} html=${bodyHtml?.length || 0} snippet=${snippet?.length || 0}`);

    // ── Idempotent upsert: check existing by rfc822_message_id ──
    const messageId = emailData.message_id || emailData.headers?.['message-id'];
    const toAddrs = parseEmailAddresses(emailData.to);
    const ccAddrs = parseEmailAddresses(emailData.cc);

    const incomingHeaders = emailData.headers || {};
    const inReplyToHeader = incomingHeaders['in-reply-to'] || incomingHeaders['In-Reply-To'] || null;
    const referencesHeader = incomingHeaders['references'] || incomingHeaders['References'] || null;

    const threading = await findOriginalThread(supabase, inReplyToHeader, referencesHeader, association.candidate_id, association.job_id);

    if (messageId) {
      const { data: existing } = await supabase
        .from('email_logs')
        .select('id, body_text, body_html, snippet, job_id, candidate_id, thread_id')
        .eq('rfc822_message_id', messageId)
        .eq('candidate_id', association.candidate_id)
        .maybeSingle();

      if (existing) {
        // Patch missing fields on existing row
        const patches: Record<string, any> = {};
        if (!existing.body_text && bodyText) patches.body_text = bodyText;
        if (!existing.body_html && bodyHtml) patches.body_html = bodyHtml;
        if (!existing.snippet && snippet) patches.snippet = snippet;
        if (!existing.job_id) patches.job_id = association.job_id;
        if (!existing.thread_id && threading.threadId) patches.thread_id = threading.threadId;

        if (Object.keys(patches).length > 0) {
          const { error: updateErr } = await supabase
            .from('email_logs')
            .update(patches)
            .eq('id', existing.id);
          console.log(`[${WEBHOOK_VERSION}] Updated existing row ${existing.id} with: ${Object.keys(patches).join(', ')}${updateErr ? ' ERROR: ' + updateErr.message : ''}`);
          return new Response(JSON.stringify({ status: 'updated', email_log_id: existing.id, patched: Object.keys(patches) }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[${WEBHOOK_VERSION}] Duplicate, nothing to patch: ${messageId}`);
        return new Response(JSON.stringify({ status: 'duplicate' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Insert new row ──
    const insertPayload = {
      user_id: null,
      tenant_id: tenantId,
      organization_id: orgId,
      direction: 'received',
      from_address: parsedFrom,
      to_addresses: toAddrs,
      cc_addresses: ccAddrs,
      subject: emailData.subject || '(No Subject)',
      body_text: bodyText,
      body_html: bodyHtml,
      status: 'delivered',
      received_at: new Date().toISOString(),
      candidate_id: association.candidate_id,
      job_id: association.job_id,
      rfc822_message_id: messageId || null,
      snippet: snippet,
      thread_id: threading.threadId || null,
      in_reply_to: threading.inReplyTo || null,
      references_header: threading.references || null,
    };

    const { data: emailLog, error: insertErr } = await supabase
      .from('email_logs')
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error(`[${WEBHOOK_VERSION}] INSERT ERROR:`, JSON.stringify(insertErr));
      return new Response(JSON.stringify({ error: 'Insert failed', detail: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${WEBHOOK_VERSION}] Inserted email: ${emailLog.id} thread: ${threading.threadId} body: text=${bodyText?.length || 0} html=${bodyHtml?.length || 0}`);

    // Fire-and-forget: log activity for inbound email
    try {
      await supabase.rpc('log_activity', {
        p_user_id: association.candidate_id,
        p_organization_id: orgId || null,
        p_tenant_id: tenantId || null,
        p_activity_type: 'candidate_email_received',
        p_title: `Email received: ${(emailData.subject || '(No Subject)').slice(0, 100)}`,
        p_description: `Reply from ${parsedFrom}`,
        p_metadata: {},
        p_entity_type: 'candidate',
        p_entity_id: association.candidate_id,
      });
      console.log(`[${WEBHOOK_VERSION}] Logged email_received activity for candidate: ${association.candidate_id}`);
    } catch (actErr: any) {
      console.error(`[${WEBHOOK_VERSION}] Failed to log email_received activity:`, actErr?.message);
    }

    return new Response(JSON.stringify({ status: 'success', email_log_id: emailLog.id, thread_id: threading.threadId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${WEBHOOK_VERSION}] Top-level error:`, error?.message || error);
    console.error(`[${WEBHOOK_VERSION}] Stack:`, error?.stack || 'no stack');
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
