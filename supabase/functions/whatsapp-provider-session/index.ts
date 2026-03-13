import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * WhatsApp Provider Session — Evolution API Adapter
 * 
 * Handles session lifecycle through the Evolution API:
 * - connect: Create instance + get QR code
 * - disconnect: Logout + delete instance
 * - status: Check connection state
 * - refresh_qr: Get a fresh QR code
 * 
 * All provider-specific logic is contained here.
 * The rest of the app works against the normalized whatsapp_sessions table.
 */

function getEvolutionConfig() {
  const baseUrl = Deno.env.get('EVOLUTION_API_URL')
  const apiKey = Deno.env.get('EVOLUTION_API_KEY')
  if (!baseUrl || !apiKey) {
    throw new Error('Evolution API not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY secrets.')
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

async function evolutionFetch(path: string, options: RequestInit = {}) {
  const { baseUrl, apiKey } = getEvolutionConfig()
  const url = `${baseUrl}${path}`
  const res = await fetch(url, {
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
  if (!res.ok) {
    console.error(`[Evolution API] ${res.status} ${path}:`, json)
    throw new Error(`Evolution API error (${res.status}): ${JSON.stringify(json)}`)
  }
  return json
}

/** Derive a stable instance name from tenant ID */
function instanceName(tenantId: string): string {
  // Evolution API instance names must be alphanumeric + hyphens
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

// ─── Actions ────────────────────────────────────────────────

async function handleConnect(supabase: any, tenantId: string) {
  const name = instanceName(tenantId)
  const { baseUrl } = getEvolutionConfig()

  // 1. Create or fetch instance
  try {
    await evolutionFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: name,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        // Set webhook for this instance
        webhook: {
          url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-provider-webhook`,
          byEvents: false,
          base64: false,
          headers: {
            'x-webhook-secret': Deno.env.get('WHATSAPP_WEBHOOK_SECRET') || 'gogio-webhook',
          },
          events: [
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'QRCODE_UPDATED',
          ],
        },
      }),
    })
  } catch (e: any) {
    // Instance may already exist — try to connect it
    if (!e.message?.includes('already')) {
      // If it's a different error, try fetching state anyway
      console.warn('[Connect] Instance create error (may already exist):', e.message)
    }
  }

  // 2. Fetch QR / connection state
  let qrData: string | null = null
  let qrExpiresAt: string | null = null
  let sessionStatus = 'waiting_for_qr'
  let connectedPhone: string | null = null

  try {
    const state = await evolutionFetch(`/instance/connectionState/${name}`)
    const connState = state?.instance?.state || state?.state || 'close'

    if (connState === 'open') {
      sessionStatus = 'connected'
      // Try to get phone number
      try {
        const info = await evolutionFetch(`/instance/fetchInstances?instanceName=${name}`)
        const inst = Array.isArray(info) ? info[0] : info
        connectedPhone = inst?.instance?.owner || inst?.owner || null
        if (connectedPhone) {
          // Clean up the phone (remove @s.whatsapp.net)
          connectedPhone = connectedPhone.replace(/@.*/, '')
        }
      } catch { /* ignore */ }
    } else {
      // Need QR code
      try {
        const qrResp = await evolutionFetch(`/instance/connect/${name}`)
        qrData = qrResp?.base64 || qrResp?.qrcode?.base64 || null
        // If we got a pairingCode instead
        if (!qrData && qrResp?.pairingCode) {
          qrData = qrResp.pairingCode
        }
        // QR codes typically expire in 45 seconds
        qrExpiresAt = new Date(Date.now() + 45_000).toISOString()
      } catch (qrErr: any) {
        console.error('[Connect] QR fetch error:', qrErr.message)
        sessionStatus = 'error'
      }
    }
  } catch (stateErr: any) {
    console.error('[Connect] State check error:', stateErr.message)
    sessionStatus = 'error'
  }

  // 3. Persist to whatsapp_sessions
  await supabase
    .from('whatsapp_sessions')
    .upsert({
      tenant_id: tenantId,
      provider: 'evolution',
      provider_session_id: name,
      session_status: sessionStatus,
      connected_phone: connectedPhone,
      connected_at: sessionStatus === 'connected' ? new Date().toISOString() : null,
      qr_code_data: qrData,
      qr_expires_at: qrExpiresAt,
      last_error: sessionStatus === 'error' ? 'Failed to initialize connection' : null,
    }, { onConflict: 'tenant_id' })

  return {
    status: sessionStatus,
    qr_code_data: qrData,
    qr_expires_at: qrExpiresAt,
    connected_phone: connectedPhone,
    instance_name: name,
  }
}

async function handleDisconnect(supabase: any, tenantId: string) {
  const name = instanceName(tenantId)

  try {
    await evolutionFetch(`/instance/logout/${name}`, { method: 'DELETE' })
  } catch (e: any) {
    console.warn('[Disconnect] Logout error (may already be disconnected):', e.message)
  }

  try {
    await evolutionFetch(`/instance/delete/${name}`, { method: 'DELETE' })
  } catch (e: any) {
    console.warn('[Disconnect] Delete error:', e.message)
  }

  await supabase
    .from('whatsapp_sessions')
    .update({
      session_status: 'disconnected',
      connected_phone: null,
      connected_at: null,
      disconnected_at: new Date().toISOString(),
      qr_code_data: null,
      qr_expires_at: null,
      last_error: null,
    })
    .eq('tenant_id', tenantId)

  return { status: 'disconnected' }
}

async function handleStatus(supabase: any, tenantId: string) {
  const name = instanceName(tenantId)
  let sessionStatus = 'disconnected'
  let connectedPhone: string | null = null
  let lastError: string | null = null

  try {
    const state = await evolutionFetch(`/instance/connectionState/${name}`)
    const connState = state?.instance?.state || state?.state || 'close'

    if (connState === 'open') {
      sessionStatus = 'connected'
      try {
        const info = await evolutionFetch(`/instance/fetchInstances?instanceName=${name}`)
        const inst = Array.isArray(info) ? info[0] : info
        connectedPhone = inst?.instance?.owner || inst?.owner || null
        if (connectedPhone) connectedPhone = connectedPhone.replace(/@.*/, '')
      } catch { /* ignore */ }
    } else if (connState === 'connecting') {
      sessionStatus = 'connecting'
    } else {
      // Check if we have a session record that was previously connected
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('session_status, connected_at')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      
      if (session?.connected_at && session?.session_status === 'connected') {
        sessionStatus = 'reconnect_required'
      } else {
        sessionStatus = 'disconnected'
      }
    }
  } catch (e: any) {
    // Instance doesn't exist
    sessionStatus = 'disconnected'
    lastError = null
  }

  // Update session
  const updateData: Record<string, any> = {
    session_status: sessionStatus,
    last_error: lastError,
  }
  if (connectedPhone) updateData.connected_phone = connectedPhone
  if (sessionStatus === 'connected' && !connectedPhone) {
    // Don't clear phone on status check
  }

  await supabase
    .from('whatsapp_sessions')
    .update(updateData)
    .eq('tenant_id', tenantId)

  return { status: sessionStatus, connected_phone: connectedPhone }
}

async function handleRefreshQr(supabase: any, tenantId: string) {
  const name = instanceName(tenantId)
  let qrData: string | null = null
  let qrExpiresAt: string | null = null

  try {
    const qrResp = await evolutionFetch(`/instance/connect/${name}`)
    qrData = qrResp?.base64 || qrResp?.qrcode?.base64 || null
    qrExpiresAt = new Date(Date.now() + 45_000).toISOString()
  } catch (e: any) {
    console.error('[RefreshQR] Error:', e.message)
    throw e
  }

  await supabase
    .from('whatsapp_sessions')
    .update({
      qr_code_data: qrData,
      qr_expires_at: qrExpiresAt,
      session_status: 'waiting_for_qr',
    })
    .eq('tenant_id', tenantId)

  return { qr_code_data: qrData, qr_expires_at: qrExpiresAt }
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

    // Verify user
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
      case 'connect':
        result = await handleConnect(supabase, tenantId)
        break
      case 'disconnect':
        result = await handleDisconnect(supabase, tenantId)
        break
      case 'status':
        result = await handleStatus(supabase, tenantId)
        break
      case 'refresh_qr':
        result = await handleRefreshQr(supabase, tenantId)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: connect, disconnect, status, refresh_qr' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[whatsapp-provider-session] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
