// Phase 4.3 — Chat retention sweeper.
//
// Runs the four-stage chat retention pipeline:
//   1. closed-job purge        → public.purge_expired_chat_threads()
//   2. inactivity soft-archive → public.chat_soft_delete_inactive_threads()
//   3. hard-delete past window → public.chat_hard_delete_threads()
//   4. drop expired monthly partitions → public.chat_drop_expired_message_partitions()
//   5. opportunistic cleanup of rate limits / audit / revoked tokens → public.chat_retention_sweep()
//
// Invoked nightly via pg_cron and also callable on demand by an operator
// with the service role.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

type RpcResult = { name: string; ok: boolean; data?: unknown; error?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

  const results: RpcResult[] = []

  async function runRpc(name: string, args?: Record<string, unknown>) {
    try {
      const { data, error } = await supabase.rpc(name, args ?? {})
      if (error) {
        console.error(`[chat-retention-sweeper] ${name} failed`, error)
        results.push({ name, ok: false, error: error.message })
      } else {
        results.push({ name, ok: true, data })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[chat-retention-sweeper] ${name} threw`, err)
      results.push({ name, ok: false, error: message })
    }
  }

  // Run sequentially — later stages depend on earlier ones (soft-delete
  // before hard-delete; hard-delete before partition drop).
  await runRpc('purge_expired_chat_threads')
  await runRpc('chat_soft_delete_inactive_threads')
  await runRpc('chat_hard_delete_threads')
  await runRpc('chat_drop_expired_message_partitions', { months_to_keep: 4 })
  await runRpc('chat_retention_sweep')

  const failed = results.filter((r) => !r.ok)
  const status = failed.length === 0 ? 200 : 207

  return new Response(
    JSON.stringify({ ok: failed.length === 0, results }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
