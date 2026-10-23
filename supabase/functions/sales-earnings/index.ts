// Gio Sales -> Gio ATS: the people an invoice credits and what each has earned
// (commissions piece 3, 2026-10-23). Sent by Gio Sales' deliver-outbox every
// time an invoice is issued, paid (in part or in full) or voided, signed with
// GIO_LINK_SECRET. sales_earnings_upsert keeps one row per person per invoice.
import { z } from 'npm:zod@3'
import { admin, inboxGet, json, linkCors, verify } from '../_shared/gioLink.ts'

const Money = z.coerce.number().finite().min(0)

const Body = z.object({
  idempotency_key: z.string().min(1).max(200),
  event: z.literal('earnings.upsert'),
  sent_at: z.string().datetime({ offset: true }),
  request: z.object({
    id: z.string().uuid(),
    number: z.string().min(1).max(40),
    invoice_number: z.string().max(80).nullish(),
    status: z.enum(['issued', 'partly_paid', 'paid', 'void']),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: Money,
    paid_amount: Money,
    issued_on: z.string().nullish(),
    paid_on: z.string().nullish(),
    client_name: z.string().max(300).nullish(),
    deal_title: z.string().max(300).nullish(),
    opening_id: z.string().uuid().nullish(),
  }),
  credits: z
    .array(
      z.object({
        id: z.string().uuid(),
        role_key: z.enum(['sales_new', 'sales_existing', 'es', 'sp', 'tap']),
        role_label: z.string().min(1).max(80),
        person_name: z.string().max(200).nullish(),
        person_email: z.string().max(320).nullish(),
        ats_user_id: z.string().uuid().nullish(),
        share_pct: z.coerce.number().min(0).max(100),
        earned_amount: Money,
        pending_amount: Money,
      }),
    )
    .max(50),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: linkCors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const raw = await req.text()
  if (!(await verify(req, raw))) return json({ error: 'Invalid signature' }, 401)
  let parsed
  try {
    parsed = Body.safeParse(JSON.parse(raw))
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400)
  const db = admin()
  const prior = await inboxGet(db, parsed.data.idempotency_key)
  if (prior) return prior

  // The RPC records the idempotency key itself, in the same transaction.
  const { data, error } = await db.rpc('sales_earnings_upsert', { payload: parsed.data })
  if (error) {
    console.error('sales_earnings_upsert failed', error)
    return json({ error: error.message }, 422)
  }
  return json(data)
})
