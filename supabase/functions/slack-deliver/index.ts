// Sends the Slack messages automations have queued (Allan, 2026-10-27).
//
// Poked by the database each time something is queued, and every minute by
// pg_cron while anything is due (x-internal-secret). Claims a batch, writes
// each message from its template and the event's details (names only, never
// pay), posts it to every destination and records how it went:
//   * every destination took it            -> sent
//   * some did                             -> sent, with what went wrong
//   * Slack asked to slow down or was down -> tried again later (up to 5 times)
//   * nothing went out                     -> failed, the reason on the automation
// When Slack says the token is gone, the connection is marked broken so the
// screens ask an admin to reconnect.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { AUTH_GONE, RETRYABLE, deliver, type Destination, type MessageContext } from '../_shared/slack.ts'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface Claimed {
  id: string
  tenant_id: string
  attempts: number
  event: string
  context: MessageContext
  automation: { id: string; message: string; destinations: Destination[]; job_id: string | null }
  connection: { token: string; team_id: string; bot_user_id: string }
}

serve(async (req) => {
  const expected = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  if (!expected || req.headers.get('x-internal-secret') !== expected) return json(401, { error: 'unauthorized' })
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  })
  let sent = 0
  let failed = 0
  const started = Date.now()
  try {
    // A few rounds, so a burst (a bulk move) goes out in one call.
    for (let round = 0; round < 4 && Date.now() - started < 40_000; round++) {
      const { data, error } = await db.rpc('slack_deliveries_claim', { _limit: 25 })
      if (error) throw error
      const batch = (data ?? []) as Claimed[]
      if (batch.length === 0) break
      const broken = new Set<string>()
      await Promise.all(batch.map(async (d) => {
        try {
          if (broken.has(d.tenant_id)) throw Object.assign(new Error('token_revoked'), { code: 'token_revoked' })
          const results = await deliver(d.connection.token, d.automation.message, d.automation.destinations ?? [], d.context ?? {})
          const posted = results.filter((r) => r.ok && !r.problem)
          const problems = results.filter((r) => r.problem).map((r) => r.problem as string)
          const codes = results.filter((r) => !r.ok).map((r) => String(r.error ?? ''))
          if (codes.some((c) => AUTH_GONE.has(c))) {
            broken.add(d.tenant_id)
            await db.rpc('slack_connection_broken', { _tenant: d.tenant_id, _detail: 'token_revoked' })
          }
          const summary = problems.length ? [...new Set(problems)].join(' ') : null
          if (posted.length > 0) {
            await db.rpc('slack_delivery_finish', { _id: d.id, _ok: true, _error: summary, _results: results })
            sent++
          } else {
            const retry = codes.length > 0 && codes.every((c) => RETRYABLE.has(c))
            await db.rpc('slack_delivery_finish', {
              _id: d.id, _ok: false, _error: summary ?? 'Nothing went out.', _results: results, _retry: retry,
            })
            failed++
          }
        } catch (err) {
          failed++
          const msg = err instanceof Error ? err.message : String(err)
          console.error('slack-deliver', d.id, msg)
          await db.rpc('slack_delivery_finish', {
            _id: d.id, _ok: false, _error: 'Gio couldn’t reach Slack; it will try again.', _retry: true,
          })
        }
      }))
    }
    return json(200, { sent, failed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('slack-deliver', msg)
    return json(500, { error: msg })
  }
})
