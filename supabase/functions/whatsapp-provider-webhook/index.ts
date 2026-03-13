import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * WhatsApp Provider Webhook — Evolution API Events
 * 
 * Receives real-time events from Evolution API:
 * - CONNECTION_UPDATE: Session state changes (connected, disconnected, QR refresh)
 * - MESSAGES_UPSERT: New messages received
 * - MESSAGES_UPDATE: Message status changes (delivered, read)
 * - QRCODE_UPDATED: Fresh QR code data
 * 
 * This is a public endpoint (no JWT) — authenticated via webhook secret header.
 */

Deno.serve(async (req) => {
  // CORS not needed for server-to-server webhooks, but handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Verify webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret')
    const expectedSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET') || 'gogio-webhook'
    if (webhookSecret !== expectedSecret) {
      console.warn('[Webhook] Invalid webhook secret')
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const event = body.event || body.type
    const instanceName = body.instance || body.instanceName
    const data = body.data || body

    console.log(`[Webhook] Event: ${event}, Instance: ${instanceName}`)

    if (!instanceName) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no instance' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Find tenant by provider_session_id (instance name)
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('tenant_id, session_status')
      .eq('provider_session_id', instanceName)
      .maybeSingle()

    if (!session) {
      console.warn(`[Webhook] No session found for instance: ${instanceName}`)
      return new Response(JSON.stringify({ ok: true, skipped: 'no session' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tenantId = session.tenant_id

    // ─── CONNECTION_UPDATE ────────────────────────────────────
    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      const state = data?.state || data?.connection || data?.status
      console.log(`[Webhook] Connection state: ${state}`)

      let sessionStatus = session.session_status
      let connectedPhone: string | null = null
      const updateData: Record<string, any> = {}

      if (state === 'open' || state === 'connected') {
        sessionStatus = 'connected'
        updateData.connected_at = new Date().toISOString()
        updateData.disconnected_at = null
        updateData.qr_code_data = null
        updateData.qr_expires_at = null
        updateData.last_error = null

        // Extract phone from instance data
        const owner = data?.instance?.owner || data?.ownerJid
        if (owner) {
          connectedPhone = owner.replace(/@.*/, '')
          updateData.connected_phone = connectedPhone
        }
      } else if (state === 'close' || state === 'disconnected' || state === 'refused') {
        // Only mark as reconnect_required if was previously connected
        if (session.session_status === 'connected' || session.session_status === 'syncing') {
          sessionStatus = 'reconnect_required'
          updateData.disconnected_at = new Date().toISOString()
        } else {
          sessionStatus = 'disconnected'
        }
      } else if (state === 'connecting') {
        sessionStatus = 'connecting'
      }

      updateData.session_status = sessionStatus

      await supabase
        .from('whatsapp_sessions')
        .update(updateData)
        .eq('tenant_id', tenantId)
    }

    // ─── QRCODE_UPDATED ──────────────────────────────────────
    if (event === 'QRCODE_UPDATED' || event === 'qrcode.updated') {
      const qrBase64 = data?.qrcode?.base64 || data?.base64
      if (qrBase64) {
        await supabase
          .from('whatsapp_sessions')
          .update({
            qr_code_data: qrBase64,
            qr_expires_at: new Date(Date.now() + 45_000).toISOString(),
            session_status: 'waiting_for_qr',
          })
          .eq('tenant_id', tenantId)
      }
    }

    // ─── MESSAGES_UPSERT ─────────────────────────────────────
    if (event === 'MESSAGES_UPSERT' || event === 'messages.upsert') {
      const messages = Array.isArray(data) ? data : (data?.messages || [data])

      for (const msg of messages) {
        const key = msg.key || {}
        const remoteJid = key.remoteJid || ''

        // Skip group chats and status broadcasts
        if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') continue

        const phone = remoteJid.replace(/@.*/, '').replace(/[^\d]/g, '')
        if (!phone) continue

        // Find or create conversation
        let { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('id, candidate_id, job_id')
          .eq('tenant_id', tenantId)
          .eq('provider_chat_id', remoteJid)
          .maybeSingle()

        if (!conv) {
          // Create new conversation
          const { data: newConv, error: insertErr } = await supabase
            .from('whatsapp_conversations')
            .insert({
              tenant_id: tenantId,
              provider_chat_id: remoteJid,
              phone_number: phone,
              display_name: msg.pushName || null,
              sync_status: 'synced',
              provider_metadata: {},
            })
            .select('id, candidate_id, job_id')
            .single()

          if (insertErr) {
            console.error('[Webhook] Failed to create conversation:', insertErr)
            continue
          }
          conv = newConv

          // Try auto-match
          const { data: matches } = await supabase.rpc('match_candidates_by_phone', {
            p_tenant_id: tenantId,
            p_phone_number: phone,
          })
          if (matches?.length === 1) {
            await supabase
              .from('whatsapp_conversations')
              .update({
                candidate_id: matches[0].candidate_id,
                linked_at: new Date().toISOString(),
              })
              .eq('id', conv.id)
            conv.candidate_id = matches[0].candidate_id
          }
        }

        // Extract message content
        const message = msg.message || {}
        const msgBody =
          message.conversation ||
          message.extendedTextMessage?.text ||
          message.imageMessage?.caption ||
          message.videoMessage?.caption ||
          msg.body || ''

        const msgId = key.id || msg.messageId
        if (!msgId) continue

        const fromMe = key.fromMe || false
        const ts = msg.messageTimestamp
        const timestamp = ts
          ? new Date(typeof ts === 'number' ? ts * 1000 : ts).toISOString()
          : new Date().toISOString()

        let mediaType: string | null = null
        if (message.imageMessage) mediaType = 'image'
        else if (message.videoMessage) mediaType = 'video'
        else if (message.audioMessage) mediaType = 'audio'
        else if (message.documentMessage) mediaType = 'document'

        // Idempotent upsert
        const { data: existingMsg } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('conversation_id', conv.id)
          .eq('provider_message_id', msgId)
          .maybeSingle()

        if (!existingMsg) {
          await supabase
            .from('whatsapp_messages')
            .insert({
              tenant_id: tenantId,
              conversation_id: conv.id,
              candidate_id: conv.candidate_id,
              job_id: conv.job_id,
              provider_message_id: msgId,
              direction: fromMe ? 'outbound' : 'inbound',
              body: msgBody || `[${mediaType || 'message'}]`,
              from_phone: fromMe ? '' : phone,
              to_phone: fromMe ? phone : '',
              sender_name: msg.pushName || null,
              status: fromMe ? 'sent' : 'synced',
              media_type: mediaType,
              provider_timestamp: timestamp,
              provider_metadata: {},
            })
        }

        // Update conversation preview
        await supabase
          .from('whatsapp_conversations')
          .update({
            last_message_at: timestamp,
            last_message_preview: (msgBody || `[${mediaType || 'message'}]`).substring(0, 100),
            unread_count: fromMe ? 0 : (conv as any).unread_count ? (conv as any).unread_count + 1 : 1,
          })
          .eq('id', conv.id)
      }
    }

    // ─── MESSAGES_UPDATE ─────────────────────────────────────
    if (event === 'MESSAGES_UPDATE' || event === 'messages.update') {
      const updates = Array.isArray(data) ? data : [data]

      for (const update of updates) {
        const msgId = update?.key?.id || update?.messageId
        const newStatus = update?.update?.status || update?.status
        if (!msgId || !newStatus) continue

        let status = 'synced'
        if (newStatus === 'DELIVERY_ACK' || newStatus === 3) status = 'delivered'
        else if (newStatus === 'READ' || newStatus === 4) status = 'read'
        else if (newStatus === 'PLAYED' || newStatus === 5) status = 'read'

        await supabase
          .from('whatsapp_messages')
          .update({ status })
          .eq('provider_message_id', msgId)
          .eq('tenant_id', tenantId)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[whatsapp-provider-webhook] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
