import { admin, json, linkCors, sign } from '../_shared/gioLink.ts'

// Delivers due outbox rows to Gio Sales, signed. Backoff: 1m, 5m, 30m, 2h, 12h (then every 12h).
const BACKOFF_MIN = [1, 5, 30, 120, 720]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: linkCors })
  const base = (Deno.env.get('GIO_SALES_URL') || '').replace(/\/+$/, '')
  if (!base) return json({ error: 'GIO_SALES_URL not configured' }, 200)
  const db = admin()
  const { data: rows } = await db.from('integration_outbox').select('id, payload, attempts')
    .is('delivered_at', null).lte('next_attempt_at', new Date().toISOString())
    .order('created_at').limit(50)
  let ok = 0, failed = 0
  for (const r of rows || []) {
    const body = JSON.stringify(r.payload)
    let err: string | null = null
    try {
      const res = await fetch(`${base}/functions/v1/ats-opening-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gio-signature': await sign(body) },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) err = `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`
    } catch (e) { err = String(e).slice(0, 500) }
    const attempts = r.attempts + 1
    if (!err) {
      ok++
      await db.from('integration_outbox').update({ delivered_at: new Date().toISOString(), attempts, last_error: null }).eq('id', r.id)
    } else {
      failed++
      const mins = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)]
      await db.from('integration_outbox').update({
        attempts, last_error: err, next_attempt_at: new Date(Date.now() + mins * 60_000).toISOString(),
      }).eq('id', r.id)
    }
  }
  return json({ delivered: ok, failed })
})
