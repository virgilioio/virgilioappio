// Gio Sales -> Gio ATS: the people an invoice credits and what each has earned
// (commissions piece 3, 2026-10-23). Sent by Gio Sales' deliver-outbox every
// time an invoice is issued, paid (in part or in full) or voided, signed with
// GIO_LINK_SECRET. sales_earnings_upsert keeps one row per person per invoice.
// Since the commission rules (2026-10-26) a credit can be any role, carries
// what it is on (basis, base_amount, its own currency), and `earnings.lead`
// brings one credit earned when a partner accepted a lead
// (sales_lead_earning_upsert).
// Since the commissions module (phase 2, 2026-10-31) `commissions.payout`
// brings each payout when it's marked paid, or when Billing undoes that
// (sales_commission_payout_upsert), for the Earnings tab's Paid and Payment
// history. Payable is never earned: only a paid payout counts.
import { z } from 'npm:zod@3'
import { admin, inboxGet, json, linkCors, verify } from '../_shared/gioLink.ts'

const Money = z.coerce.number().finite().min(0)
const RoleKey = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/)
const Currency = z.string().regex(/^[A-Z]{3}$/)

const Invoice = z.object({
  idempotency_key: z.string().min(1).max(200),
  event: z.literal('earnings.upsert'),
  sent_at: z.string().datetime({ offset: true }),
  request: z.object({
    id: z.string().uuid(),
    number: z.string().min(1).max(40),
    invoice_number: z.string().max(80).nullish(),
    status: z.enum(['issued', 'partly_paid', 'paid', 'void']),
    currency: Currency,
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
        role_key: RoleKey,
        role_label: z.string().min(1).max(80),
        role_id: z.string().uuid().nullish(),
        person_name: z.string().max(200).nullish(),
        person_email: z.string().max(320).nullish(),
        ats_user_id: z.string().uuid().nullish(),
        basis: z.enum(['percent', 'fixed']).nullish(),
        share_pct: z.coerce.number().min(0).max(100),
        base_amount: Money.nullish(),
        currency: Currency.nullish(),
        earned_amount: Money,
        pending_amount: Money,
      }),
    )
    .max(50),
})

const Lead = z.object({
  idempotency_key: z.string().min(1).max(200),
  event: z.literal('earnings.lead'),
  sent_at: z.string().datetime({ offset: true }),
  credit: z.object({
    id: z.string().uuid(),
    role_key: RoleKey,
    role_label: z.string().min(1).max(80),
    role_id: z.string().uuid().nullish(),
    person_name: z.string().max(200).nullish(),
    person_email: z.string().max(320).nullish(),
    amount: Money,
    currency: Currency,
    earned_on: z.string().date(),
    status: z.enum(['earned', 'void']),
    void_reason: z.string().max(300).nullish(),
  }),
  lead: z.object({
    deal_id: z.string().uuid().nullish(),
    deal_title: z.string().max(300).nullish(),
    client_name: z.string().max(300).nullish(),
    partner_name: z.string().max(300).nullish(),
    item_name: z.string().max(300).nullish(),
  }),
})

const Payout = z.object({
  idempotency_key: z.string().min(1).max(200),
  event: z.literal('commissions.payout'),
  sent_at: z.string().datetime({ offset: true }),
  payout_id: z.string().uuid(),
  member_email: z.string().max(320),
  member_name: z.string().max(200).nullish(),
  ats_user_id: z.string().uuid().nullish(),
  month: z.string().date(),
  currency: Currency,
  total: z.coerce.number().finite(),
  status: z.enum(['draft', 'approved', 'paid']),
  paid_on: z.string().date().nullish(),
  historical: z.boolean().nullish(),
  note: z.string().max(500).nullish(),
  lines: z.coerce.number().int().min(0).nullish(),
  invoice_number: z.string().max(40).nullish(),
  // The invoice credits and lead credits it paid (os_earnings.sales_credit_id).
  credit_ids: z.array(z.string().uuid()).max(1000).nullish(),
})

const Body = z.discriminatedUnion('event', [Invoice, Lead, Payout])

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
  const fn =
    parsed.data.event === 'earnings.lead'
      ? 'sales_lead_earning_upsert'
      : parsed.data.event === 'commissions.payout'
        ? 'sales_commission_payout_upsert'
        : 'sales_earnings_upsert'
  const { data, error } = await db.rpc(fn, { payload: parsed.data })
  if (error) {
    console.error(`${fn} failed`, error)
    return json({ error: error.message }, 422)
  }
  return json(data)
})
