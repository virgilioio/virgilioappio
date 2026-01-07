import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// Verify Svix webhook signature manually
async function verifyWebhookSignature(
  payload: string,
  headers: { id: string; timestamp: string; signature: string },
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  
  // Extract the actual secret (remove whsec_ prefix if present)
  const secretBytes = secret.startsWith('whsec_') 
    ? Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0))
    : encoder.encode(secret);
  
  // Create the signed content
  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  
  // Import the key for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // Sign the content
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  
  // Parse the signature header (format: v1,<sig1> v1,<sig2> ...)
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

// Find ingest code in recipients
function findCandidateIngestCode(emailData: any): { code: string | null; foundIn: string } {
  const check = (addrs: any, label: string) => {
    const list = Array.isArray(addrs) ? addrs : [addrs].filter(Boolean);
    for (const addr of list) {
      const code = extractCandidateIngestCode(addr);
      if (code) return { code, foundIn: `${label}:${addr}` };
    }
    return null;
  };
  
  return check(emailData.to, 'to') || check(emailData.cc, 'cc') || { code: null, foundIn: '' };
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

    // Verify signature
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
    console.log('[Candidate Reply] From:', emailData.from, 'Subject:', emailData.subject);

    if (isCalendarInvite(emailData)) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'calendar' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code: ingestCode, foundIn } = findCandidateIngestCode(emailData);

    if (!ingestCode) {
      console.log('[Candidate Reply] No jc_ code found');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no_jc_code' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Candidate Reply] Ingest code:', ingestCode, 'in:', foundIn);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: association, error: assocErr } = await supabase
      .from('job_candidate_associations')
      .select(`
        id, candidate_id, job_id,
        candidate:candidates(id, candidate_name, email),
        job:jobs(id, title, tenant_id, organization_id)
      `)
      .eq('email_ingest_code', ingestCode)
      .single();

    if (assocErr || !association) {
      console.error('[Candidate Reply] Association not found:', ingestCode);
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const job = association.job as any;
    const candidate = association.candidate as any;
    const tenantId = job?.tenant_id;
    const orgId = job?.organization_id;

    if (!tenantId || !orgId) {
      return new Response(JSON.stringify({ error: 'Invalid context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: member } = await supabase
      .from('members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('user_status', 'active')
      .limit(1)
      .single();

    if (!member?.user_id) {
      return new Response(JSON.stringify({ error: 'No org member' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check duplicate
    const messageId = emailData.message_id || emailData.headers?.['message-id'];
    if (messageId) {
      const { data: existing } = await supabase
        .from('email_logs')
        .select('id')
        .eq('rfc822_message_id', messageId)
        .single();
      
      if (existing) {
        return new Response(JSON.stringify({ status: 'duplicate' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const toAddrs = Array.isArray(emailData.to) ? emailData.to : [emailData.to].filter(Boolean);
    const ccAddrs = Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc].filter(Boolean);

    const { data: emailLog, error: insertErr } = await supabase
      .from('email_logs')
      .insert({
        user_id: member.user_id,
        tenant_id: tenantId,
        organization_id: orgId,
        direction: 'received',
        from_address: emailData.from,
        to_addresses: toAddrs,
        cc_addresses: ccAddrs,
        subject: emailData.subject || '(No Subject)',
        body_text: emailData.text || null,
        body_html: emailData.html || null,
        status: 'delivered',
        received_at: new Date().toISOString(),
        candidate_id: association.candidate_id,
        job_id: association.job_id,
        rfc822_message_id: messageId || null,
        snippet: emailData.text?.substring(0, 200) || null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    console.log('[Candidate Reply] Logged:', emailLog.id);

    // Log activity
    await supabase.rpc('log_activity', {
      p_user_id: member.user_id,
      p_organization_id: orgId,
      p_activity_type: 'candidate_email_received',
      p_title: `Reply received: ${emailData.subject || '(No Subject)'}`,
      p_description: `${candidate?.candidate_name || 'Candidate'} replied`,
      p_metadata: { email_log_id: emailLog.id, from: emailData.from },
      p_entity_type: 'candidate',
      p_entity_id: association.candidate_id,
    });

    return new Response(JSON.stringify({ status: 'success', email_log_id: emailLog.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Candidate Reply] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
