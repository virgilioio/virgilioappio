import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * WhatsApp Message Sync Edge Function
 * 
 * Accepts normalized messages from a provider adapter
 * and upserts them into the whatsapp_messages table.
 * 
 * Messages are linked to their parent conversation.
 * Candidate/job IDs are inherited from the conversation.
 * 
 * Provider-agnostic — works with GoGio's normalized message format.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get tenant
    const { data: member } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .limit(1)
      .maybeSingle()

    if (!member?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = member.tenant_id
    const body = await req.json()
    const conversationId: string = body.conversation_id
    const messages: Array<{
      provider_message_id: string
      direction: 'inbound' | 'outbound'
      body: string
      from_phone: string
      to_phone: string
      sender_name?: string
      timestamp: string
      status?: string
      media_type?: string
      media_url?: string
      metadata?: Record<string, unknown>
    }> = body.messages || []

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversation_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify conversation belongs to tenant
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('id, candidate_id, job_id, tenant_id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let synced = 0

    for (const msg of messages) {
      // Idempotent upsert using provider_message_id
      const { data: existing } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('provider_message_id', msg.provider_message_id)
        .maybeSingle()

      const msgData = {
        tenant_id: tenantId,
        conversation_id: conversationId,
        candidate_id: conversation.candidate_id,
        job_id: conversation.job_id,
        provider_message_id: msg.provider_message_id,
        direction: msg.direction,
        body: msg.body,
        from_phone: msg.from_phone,
        to_phone: msg.to_phone,
        sender_name: msg.sender_name || null,
        status: msg.status || 'synced',
        media_type: msg.media_type || null,
        media_url: msg.media_url || null,
        provider_timestamp: msg.timestamp,
        provider_metadata: msg.metadata || {},
      }

      if (existing) {
        // Update status only (don't overwrite content)
        await supabase
          .from('whatsapp_messages')
          .update({ status: msg.status || 'synced' })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('whatsapp_messages')
          .insert(msgData)
      }

      synced++
    }

    // Update conversation last message
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message_at: lastMsg.timestamp,
          last_message_preview: lastMsg.body?.substring(0, 100) || null,
        })
        .eq('id', conversationId)
    }

    return new Response(
      JSON.stringify({ synced }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Message sync error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})