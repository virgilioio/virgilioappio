import { z } from 'npm:zod@3'
import { admin, inboxGet, inboxPut, json, linkCors, tenantId, verify } from '../_shared/gioLink.ts'

const Person = z.object({ id: z.string().max(100), name: z.string().max(300).nullish(), email: z.string().max(300).nullish() })
const Body = z.object({
  idempotency_key: z.string().min(1).max(200),
  deal_id: z.string().uuid(),
  attribution: z.object({ sales: z.array(Person).max(50), es: z.array(Person).max(50) }),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: linkCors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const raw = await req.text()
  if (!(await verify(req, raw))) return json({ error: 'Invalid signature' }, 401)
  let parsed
  try { parsed = Body.safeParse(JSON.parse(raw)) } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400)
  const p = parsed.data
  const db = admin()
  const prior = await inboxGet(db, p.idempotency_key)
  if (prior) return prior

  const { data, error } = await db.rpc('sales_attribution_updated', {
    _tenant_id: tenantId(), _deal_id: p.deal_id, _attribution: p.attribution,
  })
  if (error) {
    console.error('sales_attribution_updated failed', error)
    return json({ error: error.message }, 422)
  }
  await inboxPut(db, p.idempotency_key, 'sales-attribution-updated', data)
  return json(data)
})
