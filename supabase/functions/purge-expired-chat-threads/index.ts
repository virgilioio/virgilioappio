// Phase 1.6 — Chat retention purge.
// Invokes public.purge_expired_chat_threads(), which soft-archives chat_threads
// on jobs closed beyond each tenant's chat_retention_days_after_close window.
//
// Scheduled nightly via pg_cron (see migration history). Also callable on demand
// by an operator using the service role.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing service role configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase.rpc('purge_expired_chat_threads')
    if (error) {
      console.error('[purge-expired-chat-threads] rpc error', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const totalPurged = Array.isArray(data)
      ? data.reduce((acc: number, row: { purged_threads?: number }) => acc + (row.purged_threads ?? 0), 0)
      : 0

    console.log('[purge-expired-chat-threads] purged', totalPurged, 'threads across', Array.isArray(data) ? data.length : 0, 'tenants')

    return new Response(
      JSON.stringify({ ok: true, tenants: data ?? [], total_purged: totalPurged }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[purge-expired-chat-threads] unexpected', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
