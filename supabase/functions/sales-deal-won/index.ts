import { z } from 'npm:zod@3'
import { admin, inboxGet, inboxPut, json, linkCors, tenantId, verify } from '../_shared/gioLink.ts'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/)
const Person = z.object({ id: z.string().max(100), name: z.string().max(300).nullish(), email: z.string().max(300).nullish() })
const Body = z.object({
  idempotency_key: z.string().min(1).max(200),
  deal: z.object({ id: z.string().uuid(), title: z.string().max(300), owner_name: z.string().max(200).nullish(), won_at: date.nullish(), url: z.string().max(1000).nullish() }),
  company: z.object({ id: z.string().uuid(), name: z.string().min(1).max(300), ats_client_id: z.string().uuid().nullish() }),
  attribution: z.object({ sales: z.array(Person).max(50), es: z.array(Person).max(50) }).nullish(),
  lines: z.array(z.object({
    line_id: z.string().uuid(), role: z.string().max(300).nullish(), hires: z.number().int().min(1).max(100),
    fee_pct: z.number().min(0).max(100).nullish(), est_salary: z.number().nullish(), currency: z.string().max(10).nullish(),
    mode: z.enum(['new', 'existing']), ats_job_id: z.string().uuid().nullish(),
    target_hire_date: date, target_start_date: date,
  }).refine((l) => (l.mode === 'new' ? !!l.role?.trim() : !!l.ats_job_id), { message: 'role required for new, ats_job_id for existing' })).min(1).max(50),
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

  const { data, error } = await db.rpc('sales_deal_won', { _tenant_id: tenantId(), _p: p })
  if (error) {
    const m = error.message || ''
    if (m.includes('JOB_NOT_FOR_CLIENT')) return json({ error: 'ats_job_id does not belong to this client', detail: m }, 422)
    if (m.includes('LINE_EXISTS')) return json({ error: 'This line was already sent to the ATS', detail: m }, 409)
    console.error('sales_deal_won failed', error)
    return json({ error: m }, 422)
  }
  await inboxPut(db, p.idempotency_key, 'sales-deal-won', data)
  return json(data)
})
