import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = createSecureCorsHeaders();

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per attachment
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total (Gmail limit)

const SendEmailSchema = z.object({
  from_email: z.string().email(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(998),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64
    content_type: z.string(),
  })).optional(),
  candidate_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
});

type SendEmailRequest = z.infer<typeof SendEmailSchema>;

async function refreshAccessToken(supabase: any, identity: any): Promise<string> {
  const { data: decryptedToken, error: decryptError } = await supabase
    .rpc('decrypt_refresh_token', { encrypted_token: identity.refresh_token_encrypted });

  if (decryptError || !decryptedToken) {
    throw new Error('Failed to decrypt refresh token');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: decryptedToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }

  const tokens = await tokenResponse.json();

  // Update the identity with new access token
  await supabase
    .from('user_mail_identities')
    .update({
      access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      sync_status: 'healthy',
    })
    .eq('id', identity.id);

  return tokens.access_token;
}

function buildRFC822Email(request: SendEmailRequest): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const lines: string[] = [];

  // Headers
  lines.push(`From: ${request.from_email}`);
  lines.push(`To: ${request.to.join(', ')}`);
  if (request.cc?.length) lines.push(`Cc: ${request.cc.join(', ')}`);
  if (request.bcc?.length) lines.push(`Bcc: ${request.bcc.join(', ')}`);
  lines.push(`Subject: ${request.subject}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push('');

  // Text/HTML parts
  if (request.body_text || request.body_html) {
    const altBoundary = `alt_${boundary}`;
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    lines.push('');

    if (request.body_text) {
      lines.push(`--${altBoundary}`);
      lines.push(`Content-Type: text/plain; charset=UTF-8`);
      lines.push('');
      lines.push(request.body_text);
      lines.push('');
    }

    if (request.body_html) {
      lines.push(`--${altBoundary}`);
      lines.push(`Content-Type: text/html; charset=UTF-8`);
      lines.push('');
      lines.push(request.body_html);
      lines.push('');
    }

    lines.push(`--${altBoundary}--`);
  }

  // Attachments
  if (request.attachments?.length) {
    for (const attachment of request.attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${attachment.content_type}`);
      lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push('');
      lines.push(attachment.content);
      lines.push('');
    }
  }

  lines.push(`--${boundary}--`);

  return lines.join('\r\n');
}

function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function replacePlaceholders(
  text: string,
  candidate: any,
  job: any,
  user: any
): Promise<string> {
  let result = text;
  
  // Candidate placeholders
  if (candidate) {
    result = result.replace(/\{\{candidate\.name\}\}/g, candidate.candidate_name || '');
    result = result.replace(/\{\{candidate\.email\}\}/g, candidate.email || '');
    result = result.replace(/\{\{candidate\.phone\}\}/g, candidate.phone || '');
    result = result.replace(/\{\{candidate\.location\}\}/g, 
      [candidate.location_city, candidate.location_state, candidate.location_country]
        .filter(Boolean)
        .join(', ') || ''
    );
  }
  
  // Job placeholders
  if (job) {
    result = result.replace(/\{\{job\.title\}\}/g, job.title || '');
    result = result.replace(/\{\{job\.department\}\}/g, job.department || '');
    result = result.replace(/\{\{job\.location\}\}/g, job.location || '');
  }
  
  // User placeholders (sender)
  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    result = result.replace(/\{\{sender\.name\}\}/g, fullName || user.email || '');
    result = result.replace(/\{\{sender\.email\}\}/g, user.email || '');
    result = result.replace(/\{\{sender\.first_name\}\}/g, user.first_name || '');
    result = result.replace(/\{\{sender\.last_name\}\}/g, user.last_name || '');
    result = result.replace(/\{\{sender\.title\}\}/g, user.title || '');
    result = result.replace(/\{\{sender\.phone\}\}/g, user.phone || '');
    result = result.replace(/\{\{sender\.linkedin\}\}/g, user.linkedin_url || '');
  }
  
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleSecureCorsPreFlight(req);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // Check if request is from service role (automation/cron jobs)
    const isServiceRole = authHeader.includes(supabaseServiceKey);
    
    const supabase = createClient(
      supabaseUrl, 
      isServiceRole ? supabaseServiceKey : supabaseAnonKey,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // For service role calls, we skip user session check
    // For user calls, we validate the session
    let user = null;
    let organizationId = null;
    
    if (!isServiceRole) {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authUser) {
        throw new Error('Unauthorized');
      }
      user = authUser;
    }

    // Parse and validate request
    const body = await req.json();
    const request = SendEmailSchema.parse(body);

    // Validate attachment sizes
    if (request.attachments?.length) {
      let totalSize = 0;
      for (const attachment of request.attachments) {
        const size = (attachment.content.length * 3) / 4; // Approximate base64 decoded size
        if (size > MAX_ATTACHMENT_SIZE) {
          throw new Error(`Attachment ${attachment.filename} exceeds 10MB limit`);
        }
        totalSize += size;
      }
      if (totalSize > MAX_TOTAL_SIZE) {
        throw new Error('Total attachments size exceeds 25MB limit');
      }
    }

    // Get organization and verify from_email
    let memberData = null;
    let identity = null;
    
    if (isServiceRole) {
      // For service role: verify the from_email exists and is active
      // Step 1: Get the mail identity
      const { data: mailIdentity, error: identityError } = await supabase
        .from('user_mail_identities')
        .select('*')
        .eq('email_address', request.from_email)
        .eq('is_active', true)
        .single();
      
      if (identityError || !mailIdentity) {
        throw new Error('From email is not a valid connected identity');
      }
      
      // Step 2: Verify the user is a member of the organization
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('organization_id, user_id')
        .eq('user_id', mailIdentity.user_id)
        .eq('organization_id', mailIdentity.organization_id)
        .single();
      
      if (memberError || !memberData) {
        throw new Error('User is not a member of the organization');
      }
      
      identity = mailIdentity;
      organizationId = memberData.organization_id;
      user = { id: memberData.user_id }; // Set user for logging purposes
      
    } else {
      // For user calls: verify organization and from_email ownership
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single();

      if (memberError) {
        throw new Error('Failed to fetch user organization');
      }
      
      memberData = member;
      organizationId = member.organization_id;

      // Verify from_email belongs to user
      const { data: mailIdentity, error: identityError } = await supabase
        .from('user_mail_identities')
        .select('*')
        .eq('user_id', user.id)
        .eq('email_address', request.from_email)
        .eq('is_active', true)
        .single();

      if (identityError || !mailIdentity) {
        throw new Error('From email is not a connected identity for this user');
      }
      
      identity = mailIdentity;
    }

    // Check if token needs refresh (expires within 5 minutes)
    let accessToken = identity.access_token;
    const expiresAt = new Date(identity.token_expires_at);
    if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      console.log('Refreshing access token for identity:', identity.id);
      accessToken = await refreshAccessToken(supabase, identity);
    }

    // Fetch candidate data if provided
    let candidateData = null;
    if (request.candidate_id) {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('candidate_name, email, phone, location_city, location_state, location_country')
        .eq('id', request.candidate_id)
        .single();
      
      if (candidate) {
        candidateData = candidate;
      }
    }

    // Fetch job data if provided
    let jobData = null;
    if (request.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title, department, location')
        .eq('id', request.job_id)
        .single();
      
      if (job) {
        jobData = job;
      }
    }

    // Get user profile for sender placeholders
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', user.id)
      .single();

    // Replace placeholders in subject and body
    const processedRequest = {
      ...request,
      subject: await replacePlaceholders(request.subject, candidateData, jobData, userProfile || user),
      body_text: request.body_text 
        ? await replacePlaceholders(request.body_text, candidateData, jobData, userProfile || user)
        : undefined,
      body_html: request.body_html
        ? await replacePlaceholders(request.body_html, candidateData, jobData, userProfile || user)
        : undefined,
    };

    // Build RFC822 email
    const rfc822 = buildRFC822Email(processedRequest);
    const encodedEmail = base64UrlEncode(rfc822);

    // Send via Gmail API
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!gmailResponse.ok) {
      const error = await gmailResponse.text();
      console.error('Gmail send failed:', error);
      
      // Log failed attempt
      await supabase.from('email_logs').insert({
        user_id: user.id,
        organization_id: organizationId,
        mail_identity_id: identity.id,
        from_address: processedRequest.from_email,
        to_addresses: processedRequest.to,
        cc_addresses: processedRequest.cc || [],
        bcc_addresses: processedRequest.bcc || [],
        subject: processedRequest.subject,
        body_text: processedRequest.body_text,
        body_html: processedRequest.body_html,
        status: 'failed',
        error_message: error,
        candidate_id: processedRequest.candidate_id || null,
        job_id: processedRequest.job_id || null,
      });

      throw new Error('Failed to send email via Gmail');
    }

    const gmailData = await gmailResponse.json();

    // Log successful send
    const { data: logData, error: logError } = await supabase
      .from('email_logs')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        mail_identity_id: identity.id,
        from_address: processedRequest.from_email,
        to_addresses: processedRequest.to,
        cc_addresses: processedRequest.cc || [],
        bcc_addresses: processedRequest.bcc || [],
        subject: processedRequest.subject,
        body_text: processedRequest.body_text,
        body_html: processedRequest.body_html,
        status: 'sent',
        provider_message_id: gmailData.id,
        thread_id: gmailData.threadId,
        sent_at: new Date().toISOString(),
        candidate_id: processedRequest.candidate_id || null,
        job_id: processedRequest.job_id || null,
        attachments: processedRequest.attachments || [],
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    // Log to activity feed if candidate_id is provided
    if (processedRequest.candidate_id) {
      const activityTitle = `Email sent: ${processedRequest.subject}`;
      const activityDescription = `Email sent to ${processedRequest.to.join(', ')}${processedRequest.cc?.length ? ` (CC: ${processedRequest.cc.join(', ')})` : ''}`;
      
      const { error: activityError } = await supabase.rpc('log_activity', {
        p_user_id: user.id,
        p_organization_id: organizationId,
        p_activity_type: 'candidate_email_sent',
        p_title: activityTitle,
        p_description: activityDescription,
        p_metadata: {
          email_log_id: logData?.id,
          message_id: gmailData.id,
          thread_id: gmailData.threadId,
          subject: processedRequest.subject,
          to: processedRequest.to,
          cc: processedRequest.cc,
          has_attachments: (processedRequest.attachments?.length || 0) > 0,
        },
        p_entity_type: 'candidate',
        p_entity_id: processedRequest.candidate_id,
      });

      if (activityError) {
        console.error('Failed to log email activity:', activityError);
        // Don't throw - email was sent successfully, just activity logging failed
      } else {
        console.log('Email activity logged successfully');
      }
    }

    console.log('Email sent successfully:', gmailData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: gmailData.id,
        thread_id: gmailData.threadId,
        log_id: logData?.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in send-user-email:', error);
    
    const status = error.message.includes('Unauthorized') ? 401 
      : error.message.includes('not a connected identity') ? 403
      : error.name === 'ZodError' ? 400
      : 500;

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.name === 'ZodError' ? error.errors : undefined,
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
