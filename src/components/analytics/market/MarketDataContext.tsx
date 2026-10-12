import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useBaseCurrency } from '@/hooks/useBaseCurrency'
import { useCurrencyRates } from '@/hooks/useCurrencyRates'
import type { DimensionId } from '../model/types'
import {
  applySelections, companyLabel, salaryBands,
  type MarketRow, type MarketSelection, type SalaryBands, type ValueContext,
} from './marketData'

/**
 * The talent database for the Intelligence widgets (Find Phase 4,
 * 2026-10-12). Loads every person once (market_talent_rows, salaries already
 * per month in the base currency) plus where they worked before, and holds
 * the page's click-to-filter selections. Each widget reads the people that
 * match the selections on every other dimension, so the chart you clicked
 * keeps all its bars and highlights the one you picked.
 */
export interface MarketBundle {
  loading: boolean
  error: unknown
  refetch: () => void
  rows: MarketRow[]
  ctx: ValueContext
  baseCurrency: string
  /** base → quote, from the workspace's currency rates */
  rates: Record<string, number>
  selections: MarketSelection[]
  toggle: (sel: MarketSelection) => void
  rowsFor: (exceptDimension?: DimensionId) => MarketRow[]
}

const Ctx = createContext<MarketBundle | null>(null)

const PAGE = 1000

async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PAGE) break
  }
  return all
}

export function MarketDataProvider({
  selections,
  onSelectionsChange,
  children,
}: {
  selections: MarketSelection[]
  onSelectionsChange: (next: MarketSelection[]) => void
  children: ReactNode
}) {
  const { tenantId, baseCurrency } = useBaseCurrency()
  const ratesQuery = useCurrencyRates()

  const rowsQuery = useQuery({
    queryKey: ['market-talent-rows', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: () => pages<MarketRow>((from, to) =>
      supabase.rpc('market_talent_rows', { p_tenant: tenantId! }).range(from, to) as unknown as PromiseLike<{ data: MarketRow[] | null; error: unknown }>),
  })

  const pastQuery = useQuery({
    queryKey: ['market-past-companies', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: () => pages<{ candidate_id: string; company: string }>((from, to) =>
      supabase.rpc('market_past_companies', { p_tenant: tenantId! }).range(from, to) as unknown as PromiseLike<{ data: { candidate_id: string; company: string }[] | null; error: unknown }>),
  })

  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data])
  const base = rows[0]?.base_currency || baseCurrency

  const ctx = useMemo<ValueContext>(() => {
    const currentById = new Map(rows.map(r => [r.id, companyLabel(r.company)]))
    const pastCompanies = new Map<string, string[]>()
    for (const p of pastQuery.data ?? []) {
      const label = companyLabel(p.company)
      if (!label || label === currentById.get(p.candidate_id)) continue
      const list = pastCompanies.get(p.candidate_id) ?? []
      if (!list.includes(label)) list.push(label)
      pastCompanies.set(p.candidate_id, list)
    }
    const bands: SalaryBands = salaryBands(
      rows.map(r => r.salary_month_base).filter((v): v is number => typeof v === 'number' && v > 0),
      base,
    )
    return { pastCompanies, bands }
  }, [rows, pastQuery.data, base])

  const rates = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of ratesQuery.data?.rates ?? []) out[String(r.quote_currency).toUpperCase()] = Number(r.rate)
    return out
  }, [ratesQuery.data])

  const toggle = useCallback((sel: MarketSelection) => {
    const has = selections.some(s => s.dimension === sel.dimension && s.value === sel.value)
    onSelectionsChange(has
      ? selections.filter(s => !(s.dimension === sel.dimension && s.value === sel.value))
      : [...selections, sel])
  }, [selections, onSelectionsChange])

  const rowsFor = useCallback(
    (exceptDimension?: DimensionId) => applySelections(rows, selections, ctx, exceptDimension),
    [rows, selections, ctx],
  )

  const value = useMemo<MarketBundle>(() => ({
    loading: rowsQuery.isLoading || pastQuery.isLoading || !tenantId,
    error: rowsQuery.error ?? pastQuery.error ?? null,
    refetch: () => { void rowsQuery.refetch(); void pastQuery.refetch() },
    rows,
    ctx,
    baseCurrency: base,
    rates,
    selections,
    toggle,
    rowsFor,
  }), [rowsQuery, pastQuery, tenantId, rows, ctx, base, rates, selections, toggle, rowsFor])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMarketBundle(): MarketBundle {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMarketBundle must be used inside MarketDataProvider')
  return v
}
