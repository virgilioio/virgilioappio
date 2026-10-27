import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { sendRatesNow } from '@/lib/os/commissions'

/**
 * Commission roles and rules (Allan, 2026-10-26). Roles are data, each with
 * the place its person comes from on a deal; rules say what a role is paid.
 * Rules are never edited: a change is a new version (same series_id) from a
 * date, and a stopped version ends the rule. The database checks every rule
 * (os_commission_rules_validate, GCR01–GCR09) and keeps the history.
 * People & Access admins edit them; everyone in the workspace reads them.
 */

export type PersonSource = 'deal_sales' | 'deal_es' | 'deal_sdr' | 'partner_owner' | 'hire_sourcer' | 'hire_recruiter'
export type SyncStatus = 'pending' | 'done' | 'refused'
export type FeeKey = 'engagement' | 'success' | 'ta-other' | 'consulting' | 'c-other'

export interface CommissionRole {
  id: string
  key: string
  label: string
  description: string | null
  person_source: PersonSource
  built_in: boolean
  active: boolean
  position: number
  /** Where it got to in Gio Sales. */
  sync_status: SyncStatus
  sync_error: string | null
}

export interface CommissionRule {
  id: string
  role_id: string
  series_id: string
  effective_from: string
  stopped: boolean
  basis: 'percent' | 'fixed'
  pct: number | null
  amount: number | null
  currency: string | null
  payable_on: 'payment' | 'lead_accepted'
  applies_to: 'services' | 'partner_items'
  fees: FeeKey[] | null
  client: 'any' | 'new' | 'existing'
  partner_items: 'any' | 'fixed' | 'recurring'
  months: number | null
  note: string | null
  created_by: string | null
  created_at: string
  sync_status: SyncStatus
  sync_error: string | null
}

/** Where a role's person comes from, grouped by the app that knows it. */
export const PERSON_SOURCES: { key: PersonSource; label: string; group: string }[] = [
  { key: 'deal_sales', label: 'Sales on the deal', group: 'From the deal in Gio Sales' },
  { key: 'deal_es', label: 'Engagement Specialist on the deal', group: 'From the deal in Gio Sales' },
  { key: 'deal_sdr', label: 'SDR on the deal', group: 'From the deal in Gio Sales' },
  { key: 'partner_owner', label: "The partner's owner", group: 'From the partner in Gio Sales' },
  { key: 'hire_sourcer', label: 'Sourcer on the hire', group: 'From the hire in Gio ATS' },
  { key: 'hire_recruiter', label: 'Recruiter on the hire', group: 'From the hire in Gio ATS' },
]
export const sourceLabel = (k: PersonSource) => PERSON_SOURCES.find((s) => s.key === k)?.label ?? k

/** Virgilio's fees, as Gio Sales names them. */
export const FEES: { key: FeeKey; label: string }[] = [
  { key: 'engagement', label: 'Engagement fees' },
  { key: 'success', label: 'Success fees' },
  { key: 'ta-other', label: 'Other TA fees' },
  { key: 'consulting', label: 'Consulting fees' },
  { key: 'c-other', label: 'Other consulting fees' },
]

export const CURRENCIES = ['USD', 'MXN', 'EUR', 'GBP', 'CAD', 'COP', 'BRL']

const num = (v: unknown) => (v == null ? null : Number(v))
const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const pctText = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`

function list(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "On what" in words: "Virgilio's services except engagement fees, new clients". */
export function ruleScope(r: Pick<CommissionRule, 'applies_to' | 'fees' | 'client' | 'partner_items'>) {
  if (r.applies_to === 'partner_items') {
    return r.partner_items === 'fixed' ? 'fixed partner items' : r.partner_items === 'recurring' ? 'recurring partner items' : 'partner items'
  }
  const fees = r.fees ?? []
  const missing = FEES.filter((f) => !fees.includes(f.key))
  const what =
    !r.fees || missing.length === 0
      ? "Virgilio's services"
      : missing.length === 1
        ? `Virgilio's services except ${missing[0].label.toLowerCase()}`
        : list(FEES.filter((f) => fees.includes(f.key)).map((f) => f.label.toLowerCase()))
  return r.client === 'any' ? what : `${what}, ${r.client} clients`
}

/** A rule as one sentence: "10% of what's paid on success fees, for 12 months per client". */
export function ruleSentence(r: Pick<CommissionRule, 'basis' | 'pct' | 'amount' | 'currency' | 'payable_on' | 'applies_to' | 'fees' | 'client' | 'partner_items' | 'months'>) {
  const pays =
    r.basis === 'percent'
      ? `${pctText(Number(r.pct ?? 0))} of what's paid`
      : `${money(Number(r.amount ?? 0), r.currency ?? 'USD')} ${r.payable_on === 'lead_accepted' ? 'when a partner accepts the lead' : 'for each invoice paid'}`
  const months = r.months ? `, for ${r.months} ${r.months === 1 ? 'month' : 'months'} per client` : ''
  return `${pays} on ${ruleScope(r)}${months}`
}

/** When a rule's money is payable, in words. */
export const payableText = (r: Pick<CommissionRule, 'payable_on'>) =>
  r.payable_on === 'lead_accepted' ? 'Payable when the lead is marked accepted' : 'Payable as Billing records each payment'

const rolesKey = (tenantId: string | undefined) => ['os-commission-roles', tenantId] as const
const rulesKey = (tenantId: string | undefined) => ['os-commission-rules', tenantId] as const

export function useCommissionRoles(tenantId: string | undefined) {
  return useQuery({
    queryKey: rolesKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<CommissionRole[]> => {
      const { data, error } = await supabase
        .from('os_commission_roles')
        .select('id, key, label, description, person_source, built_in, active, position, sync_status, sync_error')
        .eq('tenant_id', tenantId!)
        .order('position')
        .order('label')
      if (error) throw error
      return (data ?? []) as CommissionRole[]
    },
  })
}

/** Every version of every rule, newest date first. */
export function useCommissionRuleVersions(tenantId: string | undefined) {
  return useQuery({
    queryKey: rulesKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<CommissionRule[]> => {
      const { data, error } = await supabase
        .from('os_commission_rules')
        .select('id, role_id, series_id, effective_from, stopped, basis, pct, amount, currency, payable_on, applies_to, fees, client, partner_items, months, note, created_by, created_at, sync_status, sync_error')
        .eq('tenant_id', tenantId!)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, pct: num(r.pct), amount: num(r.amount) })) as CommissionRule[]
    },
  })
}

/** "Oct 26, 2026" from "2026-10-26". */
export function dayText(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Today's date as YYYY-MM-DD in the browser's time zone. */
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface RuleSeries {
  series_id: string
  role_id: string
  /** The version in force on the day, or null when it hasn't started or has stopped. */
  current: CommissionRule | null
  /** The next version after the day (a change or a stop), if any. */
  next: CommissionRule | null
  /** The latest version of all, for "Change" to start from. */
  latest: CommissionRule
}

/** A role's rules on a day: one entry per series that is in force or starts later. */
export function seriesFor(versions: CommissionRule[], roleId: string, on = todayIso()): RuleSeries[] {
  const bySeries = new Map<string, CommissionRule[]>()
  for (const v of versions) {
    if (v.role_id !== roleId) continue
    const list = bySeries.get(v.series_id) ?? []
    list.push(v)
    bySeries.set(v.series_id, list)
  }
  const out: RuleSeries[] = []
  for (const [series_id, vs] of bySeries) {
    const asc = [...vs].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    const inForce = [...asc].reverse().find((v) => v.effective_from <= on) ?? null
    const next = asc.find((v) => v.effective_from > on) ?? null
    const current = inForce && !inForce.stopped ? inForce : null
    if (!current && !next) continue
    if (!current && next?.stopped) continue
    out.push({ series_id, role_id: roleId, current, next, latest: asc[asc.length - 1] })
  }
  return out.sort((a, b) => (a.current ?? a.next!).effective_from.localeCompare((b.current ?? b.next!).effective_from))
}

/** A refusal from the database, worded for people. */
export function ruleError(e: { code?: string; message?: string } | null, fallback: string) {
  if (e?.code?.startsWith('GCR') && e.message) return e.message
  if (e?.code === '23505') return 'There is already a version of this rule from that date. Pick another date.'
  if (e?.code === '42501') return 'Only People & Access admins can change commissions.'
  return fallback
}

function useRefresh(tenantId: string | undefined) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: rolesKey(tenantId) })
    void qc.invalidateQueries({ queryKey: rulesKey(tenantId) })
    void qc.invalidateQueries({ queryKey: ['os-commission-rates', tenantId] })
    void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
  }
}

export interface RoleInput {
  label: string
  description: string | null
  person_source?: PersonSource
}

export function useSaveRole(tenantId: string | undefined) {
  const refresh = useRefresh(tenantId)
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RoleInput }) => {
      const { error } = id
        ? await supabase.from('os_commission_roles').update({ label: input.label, description: input.description }).eq('id', id)
        : await supabase.from('os_commission_roles').insert(
            // The key is made from the name by the database (signed-in users can't write it).
            {
              tenant_id: tenantId!,
              label: input.label,
              description: input.description,
              person_source: input.person_source!,
            } as never,
          )
      if (error) {
        if (error.code === '23505') throw new Error('There is already a role with that name.')
        throw new Error(ruleError(error, "Couldn't save the role. Try again."))
      }
    },
    onSuccess: refresh,
  })
}

export function useSetRoleActive(tenantId: string | undefined) {
  const refresh = useRefresh(tenantId)
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('os_commission_roles').update({ active }).eq('id', id)
      if (error) throw new Error(ruleError(error, "Couldn't change the role. Try again."))
    },
    onSuccess: refresh,
  })
}

export type RuleInput = Pick<
  CommissionRule,
  'basis' | 'pct' | 'amount' | 'currency' | 'payable_on' | 'applies_to' | 'fees' | 'client' | 'partner_items' | 'months' | 'effective_from' | 'note'
> & { stopped?: boolean }

/** Adds a rule, a new version of one (series_id), or a stop (stopped). */
export function useAddRule(tenantId: string | undefined) {
  const refresh = useRefresh(tenantId)
  return useMutation({
    mutationFn: async ({ roleId, seriesId, input }: { roleId: string; seriesId?: string; input: RuleInput }) => {
      const { error } = await supabase.from('os_commission_rules').insert({
        tenant_id: tenantId!,
        role_id: roleId,
        series_id: seriesId ?? null,
        ...input,
        stopped: input.stopped ?? false,
      })
      if (error) throw new Error(ruleError(error, "Couldn't save the rule. Try again."))
    },
    onSuccess: () => {
      refresh()
      // A built-in role's new rate goes to Gio Sales as before.
      if (tenantId) void sendRatesNow(tenantId).finally(refresh)
    },
  })
}
