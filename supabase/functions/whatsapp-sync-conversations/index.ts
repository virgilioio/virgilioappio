import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * WhatsApp Conversation Sync Edge Function
 * 
 * Accepts normalized conversations from a provider adapter
 * and upserts them into the whatsapp_conversations table.
 * 
 * Also performs automatic candidate matching by phone number.
 * 
 * This function is provider-agnostic — it only works with
 * GoGio's normalized conversation format.
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
    const conversations: Array<{
      provider_chat_id: string
      phone_number: string
      display_name: string | null
      last_message_at: string | null
      last_message_preview: string | null
      unread_count: number
      metadata?: Record<string, unknown>
    }> = body.conversations || []

    if (conversations.length === 0) {
      return new Response(JSON.stringify({ synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let synced = 0
    let autoLinked = 0

    for (const conv of conversations) {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('whatsapp_conversations')
        .select('id, candidate_id, is_manually_linked')
        .eq('tenant_id', tenantId)
        .eq('provider_chat_id', conv.provider_chat_id)
        .maybeSingle()

      // Auto-match candidate by phone if not already linked
      let candidateId = existing?.candidate_id || null
      let isManuallyLinked = existing?.is_manually_linked || false

      if (!candidateId && !isManuallyLinked) {
        // Try phone matching
        const { data: matches } = await supabase.rpc('match_candidates_by_phone', {
          p_tenant_id: tenantId,
          p_phone_number: conv.phone_number,
        })

        if (matches && matches.length === 1) {
          // Single exact match — auto-link
          candidateId = matches[0].candidate_id
        }
        // Multiple matches left for manual review (unlinked)
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
        provider_metadata: conv.metadata || {},
      }

      if (candidateId && !existing?.candidate_id) {
        upsertData.candidate_id = candidateId
        upsertData.linked_at = new Date().toISOString()
        autoLinked++
      }

      if (existing) {
        // Update existing — preserve manual link decisions
        const updateData = { ...upsertData }
        delete updateData.tenant_id // can't update tenant_id
        if (existing.is_manually_linked) {
          // Don't overwrite candidate_id on manually linked conversations
          delete updateData.candidate_id
          delete updateData.linked_at
        }
        await supabase
          .from('whatsapp_conversations')
          .update(updateData)
          .eq('id', existing.id)
      } else {
        // Insert new
        await supabase
          .from('whatsapp_conversations')
          .insert(upsertData)
      }

      synced++
    }

    // Update session conversation count
    const { count } = await supabase
      .from('whatsapp_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    await supabase
      .from('whatsapp_sessions')
      .update({
        conversation_count: count || 0,
        last_sync_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    return new Response(
      JSON.stringify({ synced, autoLinked, total: count }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Conversation sync error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})