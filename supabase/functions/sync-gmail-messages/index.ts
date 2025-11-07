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
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    }>;
  };
  internalDate?: string;
}

async function refreshAccessToken(supabase: any, identity: any): Promise<string> {
  console.log('Refreshing access token for identity:', identity.id);
  
  const { data: decryptedToken, error: decryptError } = await supabase
    .rpc('decrypt_refresh_token', { encrypted_token: identity.encrypted_refresh_token });

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

  console.log('Access token refreshed successfully');
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

async function findCandidateByEmail(supabase: any, email: string, organizationId: string): Promise<string | null> {
  const { data } = await supabase
    .from('candidates')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .single();
  
  return data?.id || null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { mail_identity_id, history_id }: SyncRequest = await req.json();

    console.log('Syncing Gmail messages for identity:', mail_identity_id);

    // Get mail identity
    const { data: identity, error: identityError } = await supabase
      .from('user_mail_identities')
      .select('*')
      .eq('id', mail_identity_id)
      .eq('user_id', user.id)
      .single();

    if (identityError || !identity) {
      throw new Error('Mail identity not found');
    }

    // Check if token needs refresh
    let accessToken = identity.access_token;
    if (new Date(identity.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(supabase, identity);
    }

    // Fetch messages from Gmail API
    const messagesUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=-in:sent`;
    const messagesResponse = await fetch(messagesUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!messagesResponse.ok) {
      throw new Error('Failed to fetch Gmail messages');
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.messages || [];

    console.log(`Found ${messages.length} messages to process`);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const msg of messages) {
      try {
        // Fetch full message details
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
        const msgResponse = await fetch(msgUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) continue;

        const fullMessage: GoogleMessage = await msgResponse.json();
        const headers = fullMessage.payload?.headers || [];
        
        const messageId = getHeader(headers, 'Message-ID');
        const from = getHeader(headers, 'From');
        const to = getHeader(headers, 'To');
        const subject = getHeader(headers, 'Subject');
        const inReplyTo = getHeader(headers, 'In-Reply-To');
        const date = getHeader(headers, 'Date');
        
        // Check if already stored
        const { data: existing } = await supabase
          .from('email_logs')
          .select('id')
          .eq('provider_message_id', messageId)
          .single();

        if (existing) {
          skippedCount++;
          continue;
        }

        // Extract email addresses
        const fromEmail = from.match(/<(.+?)>/)?.[1] || from;
        const toEmails = to.split(',').map(e => e.match(/<(.+?)>/)?.[1] || e.trim());
        
        // Try to find candidate
        const candidateId = await findCandidateByEmail(supabase, fromEmail, identity.organization_id);

        // Extract body
        const { text, html } = extractEmailBody(fullMessage);
        const receivedDate = date ? new Date(date) : new Date(parseInt(fullMessage.internalDate || '0'));

        // Store in email_logs
        const { error: insertError } = await supabase
          .from('email_logs')
          .insert({
            user_id: user.id,
            organization_id: identity.organization_id,
            mail_identity_id: identity.id,
            candidate_id: candidateId,
            direction: 'received',
            from_address: fromEmail,
            to_addresses: toEmails,
            subject: subject,
            body_text: text,
            body_html: html,
            thread_id: fullMessage.threadId,
            provider_message_id: messageId,
            in_reply_to: inReplyTo,
            received_at: receivedDate.toISOString(),
            is_read: !fullMessage.labelIds?.includes('UNREAD'),
            gmail_labels: fullMessage.labelIds || [],
            raw_message_data: fullMessage,
            status: 'delivered',
          });

        if (insertError) {
          console.error('Failed to insert email:', insertError);
          continue;
        }

        syncedCount++;
      } catch (error) {
        console.error('Error processing message:', error);
        continue;
      }
    }

    // Update last sync time
    await supabase
      .from('user_mail_identities')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', mail_identity_id);

    console.log(`Sync complete: ${syncedCount} synced, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount,
        skipped: skippedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
