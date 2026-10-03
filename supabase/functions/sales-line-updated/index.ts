import { z } from 'npm:zod@3'
import { admin, inboxGet, inboxPut, json, linkCors, tenantId, verify } from '../_shared/gioLink.ts'

const Body = z.object({
  idempotency_key: z.string().min(1).max(200),
  line_id: z.string().uuid(),
  hires: z.number().int().min(0).max(100),
  fee_pct: z.number().min(0).max(100).nullish(),
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

  const { data, error } = await db.rpc('sales_line_updated', {
    _tenant_id: tenantId(), _line_id: p.line_id, _hires: p.hires, _fee: p.fee_pct ?? null,
  })
  if (error) return json({ error: error.message }, 422)
  if (data?.error === 'LINE_NOT_FOUND') return json({ error: 'Unknown line' }, 404)
  if (data?.error === 'HIRES_BELOW_ACTIVE') {
    const body = { error: `Hires can't go below the ${data.active} openings in use. Cancel openings in the ATS first.`, open_req_ids: data.open_req_ids }
    await inboxPut(db, p.idempotency_key, 'sales-line-updated', body, 409)
    return json(body, 409)
  }
  await inboxPut(db, p.idempotency_key, 'sales-line-updated', data)
  return json(data)
})
