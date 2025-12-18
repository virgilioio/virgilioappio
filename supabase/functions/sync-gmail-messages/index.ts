import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  mail_identity_id: string;
  history_id?: string;
}

interface GoogleMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    mimeType?: string;
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    }>;
  };
  internalDate?: string;
}

interface SyncStats {
  total: number;
  fetched: number;
  sent: number;
  received: number;
  upserted: number;
  skipped: number;
  matched: number;
  errors: number;
}

// Normalize email address: extract from "Name <email>" format and lowercase
function normalizeEmail(email: string): string {
  if (!email) return '';
  const match = email.match(/<(.+?)>/);
  return (match ? match[1] : email).toLowerCase().trim();
}

// Parse multiple email addresses from a comma-separated string
function parseEmailAddresses(emailStr: string): string[] {
  if (!emailStr) return [];
  return emailStr.split(',').map(e => normalizeEmail(e)).filter(Boolean);
}

async function refreshAccessToken(supabase: any, identity: any): Promise<string> {
  console.log('[Gmail Sync] Refreshing access token for identity:', identity.id);
  
  const { data: decryptedToken, error: decryptError } = await supabase
    .rpc('decrypt_refresh_token', { encrypted_token: identity.refresh_token_encrypted });

  if (decryptError || !decryptedToken) {
    throw new Error('Failed to decrypt refresh token');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
      refresh_token: decryptedToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh access token');
  }

  const tokens = await tokenResponse.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase
    .from('user_mail_identities')
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiry.toISOString(),
    })
    .eq('id', identity.id);

  console.log('[Gmail Sync] Access token refreshed successfully');
  return tokens.access_token;
}

function decodeBase64(str: string): string {
  try {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return '';
  }
}

function getHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractEmailBody(message: GoogleMessage): { text: string; html: string } {
  const parts = message.payload?.parts || [];
  let textBody = '';
  let htmlBody = '';

  // Check main body first
  if (message.payload?.body?.data) {
    const mimeType = message.payload?.mimeType || '';
    const decoded = decodeBase64(message.payload.body.data);
    if (mimeType.includes('text/plain')) textBody = decoded;
    if (mimeType.includes('text/html')) htmlBody = decoded;
  }

  // Check parts
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      textBody = decodeBase64(part.body.data);
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody = decodeBase64(part.body.data);
    }
    // Check nested parts
    if (part.parts) {
      for (const nested of part.parts) {
        if (nested.mimeType === 'text/plain' && nested.body?.data) {
          textBody = decodeBase64(nested.body.data);
        }
        if (nested.mimeType === 'text/html' && nested.body?.data) {
          htmlBody = decodeBase64(nested.body.data);
        }
      }
    }
  }

  return { text: textBody, html: htmlBody };
}

// Find candidate by email - checks multiple emails, returns first match
// Uses tenant_id for scoping, with organization_id as optional additional filter
async function findCandidateByEmails(
  supabase: any, 
  emails: string[], 
  tenantId: string,
  organizationId?: string
): Promise<string | null> {
  for (const email of emails) {
    if (!email) continue;
    
    let query = supabase
      .from('candidates')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', email);
    
    // Add organization filter if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      console.log(`[Gmail Sync] Error finding candidate by email ${email}:`, error.message);
      continue;
    }
    
    if (data?.id) {
      return data.id;
    }
  }
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stats: SyncStats = {
    total: 0,
    fetched: 0,
    sent: 0,
    received: 0,
    upserted: 0,
    skipped: 0,
    matched: 0,
    errors: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { mail_identity_id }: SyncRequest = await req.json();

    console.log('[Gmail Sync] Starting sync for identity:', mail_identity_id);

    // Get mail identity
    const { data: identity, error: identityError } = await supabase
      .from('user_mail_identities')
      .select('*')
      .eq('id', mail_identity_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (identityError || !identity) {
      throw new Error('Mail identity not found');
    }

    // Determine mailbox email (the email address of this identity)
    const mailboxEmail = normalizeEmail(identity.email_address);
    console.log('[Gmail Sync] Mailbox email:', mailboxEmail);

    // Check if token needs refresh
    let accessToken = identity.access_token;
    if (new Date(identity.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(supabase, identity);
    }

    // Use Gmail History API for incremental sync if we have a historyId
    console.log(`[Gmail Sync] Current historyId: ${identity.history_id || 'none'}`);
    
    let messages: Array<{ id: string }> = [];
    let newHistoryId = null;
    
    if (identity.history_id) {
      // Incremental sync using History API
      console.log(`[Gmail Sync] Using History API for incremental sync from historyId: ${identity.history_id}`);
      const historyResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${identity.history_id}&historyTypes=messageAdded`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!historyResponse.ok) {
        if (historyResponse.status === 404) {
          console.log(`[Gmail Sync] HistoryId expired, falling back to full sync`);
          identity.history_id = null;
        } else {
          throw new Error(`Gmail History API error: ${historyResponse.statusText}`);
        }
      } else {
        const historyData = await historyResponse.json();
        newHistoryId = historyData.historyId;
        
        if (historyData.history) {
          messages = historyData.history
            .flatMap((h: any) => h.messagesAdded || [])
            .map((ma: any) => ({ id: ma.message.id }));
          console.log(`[Gmail Sync] History API found ${messages.length} new messages`);
        } else {
          console.log(`[Gmail Sync] No new messages in history`);
        }
      }
    }
    
    // Full sync if no historyId or it expired
    if (!identity.history_id) {
      console.log(`[Gmail Sync] Fetching recent messages (full sync)...`);
      // Exclude spam and trash for cleaner sync
      const query = 'newer_than:7d -in:spam -in:trash';
      const messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!messagesResponse.ok) {
        throw new Error(`Gmail API error: ${messagesResponse.statusText}`);
      }

      const messagesData = await messagesResponse.json();
      messages = messagesData.messages || [];
      console.log(`[Gmail Sync] Found ${messages.length} total messages in last 7 days`);
    }

    stats.total = messages.length;
    console.log(`[Gmail Sync] Processing ${messages.length} messages...`);

    for (const msg of messages) {
      try {
        // Fetch full message details
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const msgResponse = await fetch(msgUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) {
          console.log(`[Gmail Sync] Failed to fetch message ${msg.id}: ${msgResponse.statusText}`);
          stats.errors++;
          continue;
        }

        const fullMessage: GoogleMessage = await msgResponse.json();
        stats.fetched++;
        
        const headers = fullMessage.payload?.headers || [];
        
        // Extract headers
        const from = getHeader(headers, 'From');
        const to = getHeader(headers, 'To');
        const cc = getHeader(headers, 'Cc');
        const subject = getHeader(headers, 'Subject');
        const rfc822MessageId = getHeader(headers, 'Message-ID') || null; // May be empty
        const inReplyTo = getHeader(headers, 'In-Reply-To') || null;
        const referencesHeader = getHeader(headers, 'References') || null;
        
        // Parse email addresses
        const fromEmail = normalizeEmail(from);
        const toEmails = parseEmailAddresses(to);
        const ccEmails = parseEmailAddresses(cc);
        
        // Determine direction: if From == mailbox email, it's sent; otherwise received
        const direction = (fromEmail === mailboxEmail) ? 'sent' : 'received';
        
        if (direction === 'sent') {
          stats.sent++;
        } else {
          stats.received++;
        }

        // Use Gmail's internalDate for timestamp (milliseconds since epoch)
        const internalDate = new Date(parseInt(fullMessage.internalDate || '0'));
        
        // Extract body
        const { text, html } = extractEmailBody(fullMessage);

        // Prepare upsert data
        // CRITICAL: provider_message_id = Gmail msg.id (NOT RFC822 Message-ID)
        const emailData: Record<string, any> = {
          user_id: user.id,
          organization_id: identity.organization_id,
          tenant_id: identity.tenant_id,
          mail_identity_id: identity.id,
          direction: direction,
          from_address: fromEmail || from, // Keep original if normalization failed
          to_addresses: toEmails.length > 0 ? toEmails : [to], // Fallback to raw
          cc_addresses: ccEmails.length > 0 ? ccEmails : null,
          subject: subject || '(No Subject)',
          body_text: text,
          body_html: html,
          thread_id: fullMessage.threadId,
          provider_message_id: msg.id, // Gmail message ID (e.g., "19b337d0d3e71af5")
          rfc822_message_id: rfc822MessageId, // RFC822 Message-ID header (may be null)
          in_reply_to: inReplyTo,
          references_header: referencesHeader,
          snippet: fullMessage.snippet || null,
          is_read: !fullMessage.labelIds?.includes('UNREAD'),
          gmail_labels: fullMessage.labelIds || [],
          status: direction === 'sent' ? 'sent' : 'delivered',
          // Store only headers in raw_message_data (not full body)
          raw_message_data: { 
            headers: headers.reduce((acc: Record<string, string>, h) => {
              acc[h.name] = h.value;
              return acc;
            }, {}),
            labelIds: fullMessage.labelIds,
            snippet: fullMessage.snippet,
          },
        };

        // Set appropriate timestamp based on direction
        if (direction === 'sent') {
          emailData.sent_at = internalDate.toISOString();
        } else {
          emailData.received_at = internalDate.toISOString();
        }

        // Upsert using the unique constraint on (mail_identity_id, provider_message_id)
        const { error: upsertError } = await supabase
          .from('email_logs')
          .upsert(emailData, {
            onConflict: 'mail_identity_id,provider_message_id',
            ignoreDuplicates: false, // Update on conflict
          });

        if (upsertError) {
          console.log(`[Gmail Sync] Upsert error for message ${msg.id}:`, upsertError.message);
          stats.errors++;
          continue;
        }

        stats.upserted++;

        // Candidate matching (after successful insert/update)
        // Do NOT block ingestion on candidate matching failure
        try {
          let candidateId: string | null = null;
          
          if (direction === 'received') {
            // Inbound: candidate is the sender
            candidateId = await findCandidateByEmails(
              supabase, 
              [fromEmail], 
              identity.tenant_id,
              identity.organization_id
            );
          } else {
            // Outbound: candidate is in To (primary), then Cc
            candidateId = await findCandidateByEmails(
              supabase, 
              [...toEmails, ...ccEmails], 
              identity.tenant_id,
              identity.organization_id
            );
          }

          if (candidateId) {
            // Update the email_log with candidate_id
            await supabase
              .from('email_logs')
              .update({ candidate_id: candidateId })
              .eq('mail_identity_id', identity.id)
              .eq('provider_message_id', msg.id);
            
            stats.matched++;
          }
        } catch (matchError) {
          // Log but don't fail - candidate matching is best-effort
          console.log(`[Gmail Sync] Candidate matching error for message ${msg.id}:`, matchError);
        }

      } catch (error) {
        console.error(`[Gmail Sync] Error processing message ${msg.id}:`, error);
        stats.errors++;
        continue;
      }
    }

    // Update last sync timestamp and historyId
    const updateData: Record<string, any> = { 
      last_sync_at: new Date().toISOString(),
      sync_status: 'active'
    };
    
    // Store new historyId if we got one (from History API)
    if (newHistoryId) {
      updateData.history_id = newHistoryId;
      console.log(`[Gmail Sync] Storing new historyId: ${newHistoryId}`);
    } else if (messages.length > 0) {
      // For full sync, get the current historyId from the last message processed
      const lastMessageId = messages[messages.length - 1].id;
      const lastMessageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${lastMessageId}?format=minimal`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      if (lastMessageResponse.ok) {
        const lastMessage = await lastMessageResponse.json();
        if (lastMessage.historyId) {
          updateData.history_id = lastMessage.historyId;
          console.log(`[Gmail Sync] Storing historyId from last message: ${lastMessage.historyId}`);
        }
      }
    }
    
    await supabase
      .from('user_mail_identities')
      .update(updateData)
      .eq('id', mail_identity_id);

    console.log('[Gmail Sync] Complete. Stats:', JSON.stringify(stats, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: stats.upserted,
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Gmail Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stats }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
