import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useBaseCurrency } from '@/hooks/useBaseCurrency'
import { format as fmtDate, eachDayOfInterval, differenceInCalendarDays } from 'date-fns'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface CrmFilters {
  ownerIds?: string[]
  companyIds?: string[]
  stageIds?: string[]
}

export interface CrmDimensionRow {
  key: string
  label: string
  openAmount: number
  wonAmount: number
  openDeals: number
  wonDeals: number
  lostDeals: number
  allDeals: number
  collected: number
  outstanding: number
}

export interface CrmAnalyticsValues {
  openPipeline: number
  revenueWon: number
  openDeals: number
  dealsWon: number
  winRate: number // 0..100
  avgSalesCycleDays: number | null
  avgDealSize: number | null
  collected: number
  outstanding: number
  newDeals: number
}

export interface CrmAnalyticsBundle {
  isLoading: boolean
  baseCurrency: string
  values: CrmAnalyticsValues
  previous: CrmAnalyticsValues
  /** Per-day series in the selected range. */
  trend: { date: string; revenueWon: number; newDeals: number; collected: number; openPipeline: number }[]
  breakdowns: {
    stage: CrmDimensionRow[]
    owner: CrmDimensionRow[]
    company: CrmDimensionRow[]
    source: CrmDimensionRow[]
  }
}

const EMPTY_VALUES: CrmAnalyticsValues = {
  openPipeline: 0,
  revenueWon: 0,
  openDeals: 0,
  dealsWon: 0,
  winRate: 0,
  avgSalesCycleDays: null,
  avgDealSize: null,
  collected: 0,
  outstanding: 0,
  newDeals: 0,
}

const EMPTY_BUNDLE: CrmAnalyticsBundle = {
  isLoading: false,
  baseCurrency: 'USD',
  values: EMPTY_VALUES,
  previous: EMPTY_VALUES,
  trend: [],
  breakdowns: { stage: [], owner: [], company: [], source: [] },
}

interface DealRow {
  id: string
  stage_id: string | null
  owner_id: string | null
  organization_id: string | null
  source: string | null
  base_amount: number | null
  created_at: string
  won_at: string | null
  lost_at: string | null
  stage_type?: string | null
}

interface PaymentRow {
  id: string
  deal_id: string
  base_amount: number | null
  paid_at: string | null
  status: string | null
}

interface StageMeta { id: string; name: string; stage_type: string | null; position: number }
interface OwnerMeta { id: string; name: string }
interface CompanyMeta { id: string; name: string }

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral',
  inbound: 'Inbound',
  outbound: 'Outbound',
  repeat_client: 'Repeat client',
  partner: 'Partner',
}

function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

function periodBefore(range: DateRange): DateRange {
  const days = Math.max(1, differenceInCalendarDays(range.endDate, range.startDate) + 1)
  const end = new Date(range.startDate)
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return { startDate: start, endDate: end }
}

function computeValues(
  deals: DealRow[],
  payments: PaymentRow[],
  range: DateRange,
  dealTotals: Map<string, number>,
): CrmAnalyticsValues {
  let openPipeline = 0
  let openDeals = 0
  let newDeals = 0
  let revenueWon = 0
  let dealsWon = 0
  let dealsLost = 0
  let cycleSum = 0
  let cycleN = 0

  for (const d of deals) {
    const amount = Number(d.base_amount ?? 0)
    const isOpen = !d.won_at && !d.lost_at
    if (isOpen) {
      openPipeline += amount
      openDeals += 1
    }
    if (d.won_at && inRange(d.won_at, range.startDate, range.endDate)) {
      revenueWon += amount
      dealsWon += 1
      const created = new Date(d.created_at).getTime()
      const won = new Date(d.won_at).getTime()
      if (won >= created) {
        cycleSum += (won - created) / (1000 * 60 * 60 * 24)
        cycleN += 1
      }
    }
    if (d.lost_at && inRange(d.lost_at, range.startDate, range.endDate)) {
      dealsLost += 1
    }
    if (inRange(d.created_at, range.startDate, range.endDate)) {
      newDeals += 1
    }
  }

  let collected = 0
  for (const p of payments) {
    const paid = (p.status ?? 'paid') === 'paid' && p.paid_at
    if (paid && inRange(p.paid_at, range.startDate, range.endDate)) {
      collected += Number(p.base_amount ?? 0)
    }
  }

  // Outstanding = sum over deals that have any billing, (deal total - collected on it).
  // Use lifetime payments (any status=paid) for outstanding calc.
  const paidByDeal = new Map<string, number>()
  for (const p of payments) {
    if ((p.status ?? 'paid') === 'paid') {
      paidByDeal.set(p.deal_id, (paidByDeal.get(p.deal_id) ?? 0) + Number(p.base_amount ?? 0))
    }
  }
  let outstanding = 0
  for (const [dealId, total] of dealTotals) {
    if (!paidByDeal.has(dealId) && (dealTotals.get(dealId) ?? 0) === 0) continue
    const paidAmt = paidByDeal.get(dealId) ?? 0
    if (paidAmt > 0 || total > 0) {
      const diff = total - paidAmt
      if (diff > 0) outstanding += diff
    }
  }

  const closed = dealsWon + dealsLost
  const winRate = closed > 0 ? (dealsWon / closed) * 100 : 0
  const avgDealSize = dealsWon > 0 ? revenueWon / dealsWon : null
  const avgSalesCycleDays = cycleN > 0 ? cycleSum / cycleN : null

  return {
    openPipeline,
    revenueWon,
    openDeals,
    dealsWon,
    winRate,
    avgSalesCycleDays,
    avgDealSize,
    collected,
    outstanding,
    newDeals,
  }
}

function buildBreakdown(
  deals: DealRow[],
  payments: PaymentRow[],
  range: DateRange,
  keyOf: (d: DealRow) => string | null,
  labelMap: Map<string, string>,
  fallbackLabel = '—',
): CrmDimensionRow[] {
  const map = new Map<string, CrmDimensionRow>()
  const ensure = (k: string): CrmDimensionRow => {
    let row = map.get(k)
    if (!row) {
      row = {
        key: k,
        label: labelMap.get(k) ?? fallbackLabel,
        openAmount: 0,
        wonAmount: 0,
        openDeals: 0,
        wonDeals: 0,
        lostDeals: 0,
        allDeals: 0,
        collected: 0,
        outstanding: 0,
      }
      map.set(k, row)
    }
    return row
  }
  const dealKeyById = new Map<string, string>()
  for (const d of deals) {
    const k = keyOf(d) ?? '__none__'
    if (!labelMap.has(k) && k === '__none__') labelMap.set(k, fallbackLabel)
    dealKeyById.set(d.id, k)
    const row = ensure(k)
    row.allDeals += 1
    const amount = Number(d.base_amount ?? 0)
    const isOpen = !d.won_at && !d.lost_at
    if (isOpen) {
      row.openAmount += amount
      row.openDeals += 1
    }
    if (d.won_at && inRange(d.won_at, range.startDate, range.endDate)) {
      row.wonAmount += amount
      row.wonDeals += 1
    }
    if (d.lost_at && inRange(d.lost_at, range.startDate, range.endDate)) {
      row.lostDeals += 1
    }
  }
  for (const p of payments) {
    const k = dealKeyById.get(p.deal_id)
    if (!k) continue
    if ((p.status ?? 'paid') === 'paid' && p.paid_at && inRange(p.paid_at, range.startDate, range.endDate)) {
      ensure(k).collected += Number(p.base_amount ?? 0)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.wonAmount + b.openAmount - (a.wonAmount + a.openAmount))
}

export function useCrmAnalyticsMetrics(dateRange: DateRange, filters: CrmFilters = {}): CrmAnalyticsBundle {
  const { user } = useAuth()
  const { baseCurrency } = useBaseCurrency()

  const ownerKey = (filters.ownerIds ?? []).slice().sort().join(',')
  const companyKey = (filters.companyIds ?? []).slice().sort().join(',')
  const stageKey = (filters.stageIds ?? []).slice().sort().join(',')

  const { data, isLoading } = useQuery({
    queryKey: [
      'crm-analytics',
      user?.id,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString(),
      ownerKey,
      companyKey,
      stageKey,
    ],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: m } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user!.id)
        .eq('user_status', 'active')
        .maybeSingle()
      const tenantId = m?.tenant_id
      if (!tenantId) return null

      // Pull all deals for the tenant (capped by Supabase limit; CRM scale is small).
      let dq = supabase
        .from('deals')
        .select('id, stage_id, owner_id, organization_id, source, base_amount, created_at, won_at, lost_at')
        .eq('tenant_id', tenantId)
      if (filters.ownerIds?.length) dq = dq.in('owner_id', filters.ownerIds)
      if (filters.companyIds?.length) dq = dq.in('organization_id', filters.companyIds)
      if (filters.stageIds?.length) dq = dq.in('stage_id', filters.stageIds)
      const { data: dealRows } = await dq.limit(5000)
      const deals = (dealRows ?? []) as DealRow[]

      const dealIds = deals.map(d => d.id)
      let payments: PaymentRow[] = []
      if (dealIds.length) {
        const { data: payRows } = await supabase
          .from('deal_payments')
          .select('id, deal_id, base_amount, paid_at, status')
          .eq('tenant_id', tenantId)
          .in('deal_id', dealIds)
          .limit(10000)
        payments = (payRows ?? []) as PaymentRow[]
      }

      // Lookup metadata
      const stageIds = Array.from(new Set(deals.map(d => d.stage_id).filter(Boolean))) as string[]
      const ownerIds = Array.from(new Set(deals.map(d => d.owner_id).filter(Boolean))) as string[]
      const orgIds = Array.from(new Set(deals.map(d => d.organization_id).filter(Boolean))) as string[]

      const sb = supabase as any
      const stagesRes: { data: StageMeta[] | null } = stageIds.length
        ? await sb.from('deal_stages').select('id, name, stage_type, position').in('id', stageIds)
        : { data: [] }
      const ownersRes: { data: any[] | null } = ownerIds.length
        ? await sb.from('profiles').select('id, first_name, last_name, email').in('id', ownerIds)
        : { data: [] }
      const orgsRes: { data: CompanyMeta[] | null } = orgIds.length
        ? await sb.from('organizations').select('id, name').in('id', orgIds)
        : { data: [] }

      const stages = ((stagesRes.data ?? []) as StageMeta[]).sort((a, b) => a.position - b.position)
      const ownerMap = new Map<string, string>()
      for (const o of (ownersRes.data ?? []) as any[]) {
        const name = [o.first_name, o.last_name].filter(Boolean).join(' ').trim() || o.email || 'Unknown'
        ownerMap.set(o.id, name)
      }
      const companyMap = new Map<string, string>()
      for (const c of (orgsRes.data ?? []) as CompanyMeta[]) companyMap.set(c.id, c.name)
      const stageMap = new Map<string, string>()
      for (const s of stages) stageMap.set(s.id, s.name)

      return { tenantId, deals, payments, stages, ownerMap, companyMap, stageMap }
    },
  })

  return useMemo<CrmAnalyticsBundle>(() => {
    if (!data) return { ...EMPTY_BUNDLE, isLoading, baseCurrency }
    const { deals, payments, stages, ownerMap, companyMap, stageMap } = data

    // Map deal -> total billed amount (sum of all payments regardless of status) for outstanding calc.
    // Per spec, "Outstanding = Σ (deal total − collected) for deals with billing".
    // "deal total" = the deal's base_amount when there is at least one payment (paid or due).
    const dealsWithBilling = new Set<string>()
    for (const p of payments) dealsWithBilling.add(p.deal_id)
    const dealTotals = new Map<string, number>()
    for (const d of deals) {
      if (dealsWithBilling.has(d.id)) dealTotals.set(d.id, Number(d.base_amount ?? 0))
    }

    const values = computeValues(deals, payments, dateRange, dealTotals)
    const prev = computeValues(deals, payments, periodBefore(dateRange), dealTotals)

    // Daily trend within range
    const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate })
    const dayKey = (iso: string) => fmtDate(new Date(iso), 'yyyy-MM-dd')
    const trendMap = new Map<string, { revenueWon: number; newDeals: number; collected: number }>()
    for (const day of days) trendMap.set(fmtDate(day, 'yyyy-MM-dd'), { revenueWon: 0, newDeals: 0, collected: 0 })
    for (const d of deals) {
      if (d.won_at && inRange(d.won_at, dateRange.startDate, dateRange.endDate)) {
        const k = dayKey(d.won_at)
        const e = trendMap.get(k); if (e) { e.revenueWon += Number(d.base_amount ?? 0) }
      }
      if (inRange(d.created_at, dateRange.startDate, dateRange.endDate)) {
        const k = dayKey(d.created_at)
        const e = trendMap.get(k); if (e) { e.newDeals += 1 }
      }
    }
    for (const p of payments) {
      if ((p.status ?? 'paid') === 'paid' && p.paid_at && inRange(p.paid_at, dateRange.startDate, dateRange.endDate)) {
        const k = dayKey(p.paid_at)
        const e = trendMap.get(k); if (e) { e.collected += Number(p.base_amount ?? 0) }
      }
    }
    const trend = days.map(day => {
      const k = fmtDate(day, 'yyyy-MM-dd')
      const e = trendMap.get(k)!
      return {
        date: fmtDate(day, 'M/d'),
        revenueWon: e.revenueWon,
        newDeals: e.newDeals,
        collected: e.collected,
        openPipeline: values.openPipeline, // open pipeline is a snapshot, not a daily curve
      }
    })

    // Stage breakdown — preserve stage order
    const stageRows = buildBreakdown(
      deals,
      payments,
      dateRange,
      d => d.stage_id,
      stageMap,
      'Unassigned',
    )
    const orderIndex = new Map(stages.map((s, i) => [s.id, i] as const))
    stageRows.sort((a, b) => (orderIndex.get(a.key) ?? 99) - (orderIndex.get(b.key) ?? 99))

    const ownerRows = buildBreakdown(deals, payments, dateRange, d => d.owner_id, ownerMap, 'Unassigned')
    const companyRows = buildBreakdown(deals, payments, dateRange, d => d.organization_id, companyMap, 'No company')

    const sourceLabels = new Map<string, string>()
    for (const [k, v] of Object.entries(SOURCE_LABELS)) sourceLabels.set(k, v)
    const sourceRows = buildBreakdown(deals, payments, dateRange, d => d.source, sourceLabels, 'No source')

    return {
      isLoading: false,
      baseCurrency,
      values,
      previous: prev,
      trend,
      breakdowns: { stage: stageRows, owner: ownerRows, company: companyRows, source: sourceRows },
    }
  }, [data, isLoading, baseCurrency, dateRange])
}
