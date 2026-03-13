import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * WhatsApp Candidate Linking Edge Function
 * 
 * Supports:
 * - link: Associate a conversation with an existing candidate
 * - unlink: Remove candidate association
 * - match: Search for candidate matches by phone number
 * - create: Create a new candidate from conversation and link
 * 
 * Manual links are preserved across re-syncs.
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
    const action: string = body.action

    // ─── MATCH: Find candidates by phone ───────────────────
    if (action === 'match') {
      const phoneNumber: string = body.phone_number
      if (!phoneNumber) {
        return new Response(JSON.stringify({ error: 'phone_number required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: matches, error } = await supabase.rpc('match_candidates_by_phone', {
        p_tenant_id: tenantId,
        p_phone_number: phoneNumber,
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ matches: matches || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── LINK: Associate conversation with candidate ───────
    if (action === 'link') {
      const conversationId: string = body.conversation_id
      const candidateId: string = body.candidate_id
      const jobId: string | null = body.job_id || null

      if (!conversationId || !candidateId) {
        return new Response(JSON.stringify({ error: 'conversation_id and candidate_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify conversation belongs to tenant
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update conversation
      const updateData: Record<string, unknown> = {
        candidate_id: candidateId,
        is_manually_linked: true,
        linked_at: new Date().toISOString(),
        linked_by: user.id,
      }
      if (jobId) updateData.job_id = jobId

      await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', conversationId)

      // Also update all messages in this conversation
      await supabase
        .from('whatsapp_messages')
        .update({ candidate_id: candidateId, job_id: jobId })
        .eq('conversation_id', conversationId)

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── UNLINK: Remove candidate association ──────────────
    if (action === 'unlink') {
      const conversationId: string = body.conversation_id

      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'conversation_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await supabase
        .from('whatsapp_conversations')
        .update({
          candidate_id: null,
          job_id: null,
          is_manually_linked: false,
          linked_at: null,
          linked_by: null,
        })
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)

      // Clear candidate/job from messages too
      await supabase
        .from('whatsapp_messages')
        .update({ candidate_id: null, job_id: null })
        .eq('conversation_id', conversationId)

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── CREATE: Create candidate from conversation ────────
    if (action === 'create') {
      const conversationId: string = body.conversation_id
      const candidateName: string = body.candidate_name

      if (!conversationId || !candidateName) {
        return new Response(JSON.stringify({ error: 'conversation_id and candidate_name required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get conversation
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, phone_number, tenant_id')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get organization_id for the tenant
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle()

      // Create candidate
      const { data: newCandidate, error: createError } = await supabase
        .from('candidates')
        .insert({
          candidate_name: candidateName,
          phone: conv.phone_number,
          tenant_id: tenantId,
          organization_id: org?.id || null,
          source: 'whatsapp',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (createError) throw createError

      // Link conversation to new candidate
      await supabase
        .from('whatsapp_conversations')
        .update({
          candidate_id: newCandidate.id,
          is_manually_linked: true,
          linked_at: new Date().toISOString(),
          linked_by: user.id,
        })
        .eq('id', conversationId)

      // Update messages
      await supabase
        .from('whatsapp_messages')
        .update({ candidate_id: newCandidate.id })
        .eq('conversation_id', conversationId)

      return new Response(
        JSON.stringify({ success: true, candidate_id: newCandidate.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: match, link, unlink, create' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Candidate linking error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})