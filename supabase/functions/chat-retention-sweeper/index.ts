// Phase 4.3 — Chat retention sweeper.
//
// Worker contract
//   Invocation:  pg_cron job `chat-retention-sweeper` nightly at 03:20 UTC,
//                posting with the project anon apikey. verify_jwt enforced.
//   Concurrency: Single-runner; each RPC stage is idempotent (selects by
//                window/age and deletes). Re-running the same night is safe.
//   Retries:     None — failures are surfaced via HTTP 207 and a per-stage
//                error in `results`. Next nightly run retries the world.
//
// Runs the four-stage chat retention pipeline:
//   1. closed-job purge        → public.purge_expired_chat_threads()
//   2. inactivity soft-archive → public.chat_soft_delete_inactive_threads()
//   3. hard-delete past window → public.chat_hard_delete_threads()
//   4. drop expired monthly partitions → public.chat_drop_expired_message_partitions()
//   5. opportunistic cleanup of rate limits / audit / revoked tokens → public.chat_retention_sweep()
//
// After the pipeline, writes a single `system`-actor row to chat_audit_log
// summarising counts so admins can see "last sweep ran at X, removed Y".

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

  // F4 — write a single system-actor audit row so admins can see the last
  // sweep outcome from the audit viewer. tenant_id is the nil UUID because
  // this run is cross-tenant; admins filter by event='retention_sweep'.
  const summary = Object.fromEntries(
    results.map((r) => [r.name, r.ok ? (r.data ?? true) : { error: r.error }]),
  )
  try {
    await supabase.from('chat_audit_log').insert({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      actor_type: 'system',
      event: 'retention_sweep',
      metadata: { ok: failed.length === 0, summary },
    })
  } catch (err) {
    console.error('[chat-retention-sweeper] audit insert failed', err)
  }

  return new Response(
    JSON.stringify({ ok: failed.length === 0, results }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})

