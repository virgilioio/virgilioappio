import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * WhatsApp Provider Sync — Evolution API
 * 
 * Pulls conversations and messages from the Evolution API,
 * normalizes them into GoGio's internal shapes, and persists
 * them through the existing sync edge functions.
 * 
 * Actions:
 * - sync_conversations: Pull all chats, normalize, upsert
 * - sync_messages: Pull messages for a conversation, normalize, upsert
 * - sync_all: Pull conversations + recent messages for each
 */

function getEvolutionConfig() {
  const baseUrl = Deno.env.get('EVOLUTION_API_URL')
  const apiKey = Deno.env.get('EVOLUTION_API_KEY')
  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API not configured')
  }
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

async function getTenantId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .limit(1)
    .maybeSingle()
  return data?.tenant_id ?? null
}

// ─── Normalization ──────────────────────────────────────────

function normalizePhone(jid: string): string {
  // Evolution API uses JIDs like "5511999999999@s.whatsapp.net"
  return (jid || '').replace(/@.*/, '').replace(/[^\d]/g, '')
}

function isGroupChat(jid: string): boolean {
  return (jid || '').includes('@g.us')
}

interface NormalizedConversation {
  provider_chat_id: string
  phone_number: string
  display_name: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  metadata: Record<string, unknown>
}

function normalizeChat(chat: any): NormalizedConversation | null {
  const jid = chat.id || chat.remoteJid || chat.jid
  if (!jid || isGroupChat(jid)) return null // Skip group chats

  const phone = normalizePhone(jid)
  if (!phone) return null

  return {
    provider_chat_id: jid,
    phone_number: phone,
    display_name: chat.name || chat.pushName || chat.notify || null,
    last_message_at: chat.lastMsgTimestamp
      ? new Date(typeof chat.lastMsgTimestamp === 'number'
          ? chat.lastMsgTimestamp * 1000
          : chat.lastMsgTimestamp
        ).toISOString()
      : null,
    last_message_preview: chat.lastMessage?.body || chat.lastMessage?.message?.conversation || null,
    unread_count: chat.unreadCount || chat.unreadMessages || 0,
    metadata: {
      archived: chat.archived || false,
      pinned: chat.pinned || false,
    },
  }
}

interface NormalizedMessage {
  provider_message_id: string
  direction: 'inbound' | 'outbound'
  body: string
  from_phone: string
  to_phone: string
  sender_name: string | null
  timestamp: string
  status: string
  media_type: string | null
  media_url: string | null
  metadata: Record<string, unknown>
}

function normalizeMessage(msg: any, instanceOwner: string): NormalizedMessage | null {
  const key = msg.key || {}
  const messageId = key.id || msg.id || msg.messageId
  if (!messageId) return null

  const remoteJid = key.remoteJid || msg.remoteJid || ''
  if (isGroupChat(remoteJid)) return null

  const fromMe = key.fromMe || msg.fromMe || false
  const remotePhone = normalizePhone(remoteJid)
  const ownerPhone = normalizePhone(instanceOwner)

  // Extract message body from various Evolution API message formats
  const message = msg.message || {}
  const body =
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    msg.body ||
    ''

  if (!body && !message.imageMessage && !message.videoMessage && !message.audioMessage && !message.documentMessage) {
    return null // Skip empty/system messages
  }

  // Determine media type
  let mediaType: string | null = null
  let mediaUrl: string | null = null
  if (message.imageMessage) mediaType = 'image'
  else if (message.videoMessage) mediaType = 'video'
  else if (message.audioMessage) mediaType = 'audio'
  else if (message.documentMessage) mediaType = 'document'

  // Timestamp
  const ts = msg.messageTimestamp || msg.timestamp
  const timestamp = ts
    ? new Date(typeof ts === 'number' ? ts * 1000 : ts).toISOString()
    : new Date().toISOString()

  // Status mapping
  let status = 'synced'
  const msgStatus = msg.status || msg.ack
  if (msgStatus === 'DELIVERY_ACK' || msgStatus === 3) status = 'delivered'
  else if (msgStatus === 'READ' || msgStatus === 4) status = 'read'
  else if (msgStatus === 'SERVER_ACK' || msgStatus === 1) status = 'sent'
  else if (msgStatus === 'ERROR' || msgStatus === -1) status = 'failed'

  return {
    provider_message_id: messageId,
    direction: fromMe ? 'outbound' : 'inbound',
    body: body || `[${mediaType || 'media'}]`,
    from_phone: fromMe ? ownerPhone : remotePhone,
    to_phone: fromMe ? remotePhone : ownerPhone,
    sender_name: msg.pushName || msg.verifiedBizName || null,
    timestamp,
    status,
    media_type: mediaType,
    media_url: mediaUrl,
    metadata: {
      ack: msg.ack,
      broadcast: msg.broadcast || false,
    },
  }
}

// ─── Sync Actions ───────────────────────────────────────────

async function syncConversations(supabase: any, tenantId: string) {
  const name = instanceName(tenantId)

  // Fetch chats from Evolution API
  const chats = await evolutionFetch(`/chat/findChats/${name}`)
  const chatList = Array.isArray(chats) ? chats : (chats?.chats || [])

  // Normalize (skip groups, empty)
  const normalized: NormalizedConversation[] = []
  for (const chat of chatList) {
    const n = normalizeChat(chat)
    if (n) normalized.push(n)
  }

  if (normalized.length === 0) {
    return { synced: 0, autoLinked: 0, total: 0 }
  }

  // Upsert conversations with candidate matching
  let synced = 0
  let autoLinked = 0

  for (const conv of normalized) {
    // Check existing
    const { data: existing } = await supabase
      .from('whatsapp_conversations')
      .select('id, candidate_id, is_manually_linked')
      .eq('tenant_id', tenantId)
      .eq('provider_chat_id', conv.provider_chat_id)
      .maybeSingle()

    let candidateId = existing?.candidate_id || null
    const isManuallyLinked = existing?.is_manually_linked || false

    // Auto-match candidate by phone
    if (!candidateId && !isManuallyLinked) {
      const { data: matches } = await supabase.rpc('match_candidates_by_phone', {
        p_tenant_id: tenantId,
        p_phone_number: conv.phone_number,
      })
      if (matches && matches.length === 1) {
        candidateId = matches[0].candidate_id
      }
    }

    const upsertData: Record<string, unknown> = {
      tenant_id: tenantId,
      provider_chat_id: conv.provider_chat_id,
      phone_number: conv.phone_number,
      display_name: conv.display_name,
      last_message_at: conv.last_message_at,
      last_message_preview: conv.last_message_preview,
      unread_count: conv.unread_count,
      sync_status: 'synced',
      provider_metadata: conv.metadata,
    }

    if (candidateId && !existing?.candidate_id) {
      upsertData.candidate_id = candidateId
      upsertData.linked_at = new Date().toISOString()
      autoLinked++
    }

    if (existing) {
      const updateData = { ...upsertData }
      delete updateData.tenant_id
      if (isManuallyLinked) {
        delete updateData.candidate_id
        delete updateData.linked_at
      }
      await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('whatsapp_conversations')
        .insert(upsertData)
    }
    synced++
  }

  // Update session stats
  const { count } = await supabase
    .from('whatsapp_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  await supabase
    .from('whatsapp_sessions')
    .update({
      conversation_count: count || 0,
      last_sync_at: new Date().toISOString(),
      session_status: 'connected',
    })
    .eq('tenant_id', tenantId)

  return { synced, autoLinked, total: count || 0 }
}

async function syncMessages(supabase: any, tenantId: string, providerChatId: string) {
  const name = instanceName(tenantId)

  // Get the conversation
  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, candidate_id, job_id')
    .eq('tenant_id', tenantId)
    .eq('provider_chat_id', providerChatId)
    .maybeSingle()

  if (!conversation) {
    throw new Error('Conversation not found for provider_chat_id: ' + providerChatId)
  }

  // Get instance owner for direction detection
  let instanceOwner = ''
  try {
    const info = await evolutionFetch(`/instance/fetchInstances?instanceName=${name}`)
    const inst = Array.isArray(info) ? info[0] : info
    instanceOwner = inst?.instance?.owner || inst?.owner || ''
  } catch { /* continue without owner */ }

  // Fetch messages from Evolution API
  const messages = await evolutionFetch(`/chat/findMessages/${name}`, {
    method: 'POST',
    body: JSON.stringify({
      where: {
        key: { remoteJid: providerChatId },
      },
      limit: 100,
    }),
  })

  const msgList = Array.isArray(messages) ? messages : (messages?.messages || [])

  let synced = 0
  for (const msg of msgList) {
    const normalized = normalizeMessage(msg, instanceOwner)
    if (!normalized) continue

    // Idempotent upsert
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('conversation_id', conversation.id)
      .eq('provider_message_id', normalized.provider_message_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('whatsapp_messages')
        .update({ status: normalized.status })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          conversation_id: conversation.id,
          candidate_id: conversation.candidate_id,
          job_id: conversation.job_id,
          provider_message_id: normalized.provider_message_id,
          direction: normalized.direction,
          body: normalized.body,
          from_phone: normalized.from_phone,
          to_phone: normalized.to_phone,
          sender_name: normalized.sender_name,
          status: normalized.status,
          media_type: normalized.media_type,
          media_url: normalized.media_url,
          provider_timestamp: normalized.timestamp,
          provider_metadata: normalized.metadata,
        })
    }
    synced++
  }

  // Update conversation with last message
  if (msgList.length > 0) {
    const lastNormalized = normalizeMessage(msgList[msgList.length - 1], instanceOwner)
    if (lastNormalized) {
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message_at: lastNormalized.timestamp,
          last_message_preview: lastNormalized.body?.substring(0, 100) || null,
        })
        .eq('id', conversation.id)
    }
  }

  return { synced, conversation_id: conversation.id }
}

async function syncAll(supabase: any, tenantId: string) {
  // 1. Sync conversations
  const convResult = await syncConversations(supabase, tenantId)

  // 2. Sync messages for recent conversations (top 20)
  const { data: recentConvs } = await supabase
    .from('whatsapp_conversations')
    .select('id, provider_chat_id')
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false })
    .limit(20)

  let totalMessagesSynced = 0
  for (const conv of (recentConvs || [])) {
    if (!conv.provider_chat_id) continue
    try {
      const msgResult = await syncMessages(supabase, tenantId, conv.provider_chat_id)
      totalMessagesSynced += msgResult.synced
    } catch (e: any) {
      console.warn(`[SyncAll] Message sync failed for ${conv.provider_chat_id}:`, e.message)
    }
  }

  return {
    conversations: convResult,
    messages_synced: totalMessagesSynced,
  }
}

// ─── Main Handler ───────────────────────────────────────────

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

    const tenantId = await getTenantId(supabase, user.id)
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const action: string = body.action

    let result: any

    switch (action) {
      case 'sync_conversations':
        result = await syncConversations(supabase, tenantId)
        break
      case 'sync_messages':
        if (!body.provider_chat_id) {
          return new Response(JSON.stringify({ error: 'provider_chat_id required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        result = await syncMessages(supabase, tenantId, body.provider_chat_id)
        break
      case 'sync_all':
        result = await syncAll(supabase, tenantId)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: sync_conversations, sync_messages, sync_all' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[whatsapp-provider-sync] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
