import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * WhatsApp Send Message — Evolution API
 * 
 * Sends a text message through the connected WhatsApp session.
 * Normalizes the sent message and persists it to whatsapp_messages.
 */

function getEvolutionConfig() {
  const baseUrl = Deno.env.get('EVOLUTION_API_URL')
  const apiKey = Deno.env.get('EVOLUTION_API_KEY')
  if (!baseUrl || !apiKey) throw new Error('Evolution API not configured')
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

async function evolutionFetch(path: string, options: RequestInit = {}) {
  const { baseUrl, apiKey } = getEvolutionConfig()
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      ...(options.headers || {}),
    },
  })
  const body = await res.text()
  let json: any
  try { json = JSON.parse(body) } catch { json = { raw: body } }
  if (!res.ok) throw new Error(`Evolution API error (${res.status}): ${JSON.stringify(json)}`)
  return json
}

function instanceName(tenantId: string): string {
  return `gogio-${tenantId.replace(/-/g, '').substring(0, 16)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: member } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .limit(1)
      .maybeSingle()

    if (!member?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = member.tenant_id
    const body = await req.json()
    const { conversation_id, text } = body

    if (!conversation_id || !text) {
      return new Response(JSON.stringify({ error: 'conversation_id and text required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get conversation
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id, provider_chat_id, candidate_id, job_id, phone_number')
      .eq('id', conversation_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!conv) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify session is connected
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('session_status, connected_phone')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!session || session.session_status !== 'connected') {
      return new Response(JSON.stringify({ error: 'WhatsApp not connected' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const name = instanceName(tenantId)
    const remoteJid = conv.provider_chat_id || `${conv.phone_number}@s.whatsapp.net`

    // Send via Evolution API
    const sendResult = await evolutionFetch(`/message/sendText/${name}`, {
      method: 'POST',
      body: JSON.stringify({
        number: remoteJid,
        text: text,
      }),
    })

    const sentMsgId = sendResult?.key?.id || sendResult?.messageId || `sent-${Date.now()}`
    const now = new Date().toISOString()

    // Persist outbound message
    await supabase
      .from('whatsapp_messages')
      .insert({
        tenant_id: tenantId,
        conversation_id: conv.id,
        candidate_id: conv.candidate_id,
        job_id: conv.job_id,
        provider_message_id: sentMsgId,
        direction: 'outbound',
        body: text,
        from_phone: session.connected_phone || '',
        to_phone: conv.phone_number,
        sender_id: user.id,
        sender_name: user.user_metadata?.full_name || user.email || null,
        status: 'sent',
        provider_timestamp: now,
        provider_metadata: {},
      })

    // Update conversation preview
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_at: now,
        last_message_preview: text.substring(0, 100),
        unread_count: 0,
      })
      .eq('id', conv.id)

    return new Response(
      JSON.stringify({ success: true, message_id: sentMsgId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[whatsapp-send-message] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
