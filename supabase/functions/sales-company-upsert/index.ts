import { z } from 'npm:zod@3'
import { admin, inboxGet, json, linkCors, verify } from '../_shared/gioLink.ts'

const Body = z.object({
  idempotency_key: z.string().min(1).max(200),
  event: z.literal('company.upsert'),
  company: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(300),
    domain: z.string().max(253).nullish(),
    status: z.enum(['customer', 'churned']),
    industry: z.string().max(200).nullish(),
    city: z.string().max(200).nullish(),
    country: z.string().max(100).nullish(),
    region: z.string().max(20).nullish(),
    deleted: z.boolean().optional().default(false),
  }),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: linkCors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const raw = await req.text()
  if (!(await verify(req, raw))) return json({ error: 'Invalid signature' }, 401)
  let parsed
  try { parsed = Body.safeParse(JSON.parse(raw)) } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400)
  const db = admin()
  const prior = await inboxGet(db, parsed.data.idempotency_key)
  if (prior) return prior

  // The RPC records the idempotency key itself, in the same transaction.
  const { data, error } = await db.rpc('sales_company_upsert', { payload: parsed.data })
  if (error) {
    console.error('sales_company_upsert failed', error)
    return json({ error: error.message }, 422)
  }
  return json(data)
})
