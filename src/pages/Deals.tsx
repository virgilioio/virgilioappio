import { useMemo, useState } from 'react'
import { Plus, Search as SearchIcon, Settings2, X } from 'lucide-react'
import { Briefcase, Handshake, Trophy, Clock } from 'lucide-react'
import { startOfMonth } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { PageHeader } from '@/components/layout/PageHeader'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { MetricStrip, type MetricItem } from '@/components/ui/metric-strip'
import {
  FilterChipSelect,
  type FilterChipSelectOption,
} from '@/components/ui/filter-chip-select'
import {
  FilterChipPopover,
  type FilterChipOption,
} from '@/components/ui/filter-chip-popover'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeals } from '@/hooks/useDeals'
import { useDealStages } from '@/hooks/useDealStages'
import { DealsKanbanBoard, type DealAmountMode } from '@/components/deals/DealsKanbanBoard'
import { DealFormSheet } from '@/components/deals/DealFormSheet'
import { DealProfileSheet } from '@/components/deals/DealProfileSheet'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { cn } from '@/lib/utils'

const AMOUNT_MODE_OPTIONS: FilterChipSelectOption<DealAmountMode>[] = [
  { value: 'total', label: 'Total' },
  { value: 'weighted', label: 'Weighted' },
]

const NONE = '__none__'

function formatCompactMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  const abs = Math.abs(amount)
  let body: string
  if (abs >= 1_000_000) body = `${(amount / 1_000_000).toFixed(1)}M`
  else if (abs >= 1_000) body = `${(amount / 1_000).toFixed(1)}k`
  else body = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
  return `${symbol}${body}`
}

function formatFullMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

export default function Deals() {
  const { canViewOrganizations } = usePermissions()
  const { data: deals = [] } = useDeals()
  const { data: stages = [] } = useDealStages()

  const [creating, setCreating] = useState(false)
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [amountMode, setAmountMode] = useState<DealAmountMode>('total')
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Stage type lookup
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])
  const isOpenStage = (sid: string | null) => {
    if (!sid) return false
    const t = stageById.get(sid)?.stage_type
    return t === 'open'
  }
  const isWonStage = (sid: string | null) => {
    if (!sid) return false
    return stageById.get(sid)?.stage_type === 'won'
  }

  // Apply filters & search to all derived data
  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return deals.filter((d) => {
      if (selectedOwners.length && !selectedOwners.includes(d.owner_id ?? NONE)) return false
      if (selectedOrgs.length && !selectedOrgs.includes(d.organization_id ?? NONE)) return false
      if (q) {
        const hay = `${d.title ?? ''} ${d.organization_name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [deals, selectedOwners, selectedOrgs, searchQuery])

  // Build owner & company facet options from full dataset (so selected stay visible)
  const ownerOptions = useMemo<FilterChipOption[]>(() => {
    const map = new Map<string, { label: string; count: number }>()
    deals.forEach((d) => {
      const key = d.owner_id ?? NONE
      const label = d.owner_id ? d.owner_name ?? d.owner_email ?? 'Unknown' : 'Unassigned'
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { label, count: 1 })
    })
    return Array.from(map.entries())
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [deals])

  const orgOptions = useMemo<FilterChipOption[]>(() => {
    const map = new Map<string, { label: string; count: number }>()
    deals.forEach((d) => {
      const key = d.organization_id ?? NONE
      const label = d.organization_id ? d.organization_name ?? 'Unknown' : 'No company'
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { label, count: 1 })
    })
    return Array.from(map.entries())
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [deals])

  // ---- KPIs (computed from filteredDeals) ----
  const baseCurrency =
    filteredDeals.find((d) => d.base_currency)?.base_currency ??
    deals.find((d) => d.base_currency)?.base_currency ??
    filteredDeals[0]?.currency ??
    deals[0]?.currency ??
    'USD'

  const openDeals = filteredDeals.filter((d) => isOpenStage(d.stage_id))

  const openPipeline = openDeals.reduce((sum, d) => {
    const v = d.base_amount ?? d.amount ?? 0
    const p = amountMode === 'weighted' ? (d.probability == null ? 1 : Number(d.probability)) : 1
    return sum + v * p
  }, 0)

  const monthStart = startOfMonth(new Date()).toISOString()
  const wonThisMonthAmount = filteredDeals
    .filter((d) => isWonStage(d.stage_id) && (d.stage_changed_at ?? d.updated_at) >= monthStart)
    .reduce((s, d) => s + (d.base_amount ?? d.amount ?? 0), 0)

  const avgDaysInStage = (() => {
    if (openDeals.length === 0) return 0
    const total = openDeals.reduce((s, d) => {
      const since = new Date(d.stage_changed_at ?? d.created_at).getTime()
      const days = Math.max(0, (Date.now() - since) / 86_400_000)
      return s + days
    }, 0)
    return total / openDeals.length
  })()

  const totalCount = filteredDeals.length
  const openCount = openDeals.length
  const headerPipelineLabel = `${formatFullMoney(openPipeline, baseCurrency)} ${baseCurrency} in pipeline`

  const metrics: MetricItem[] = [
    {
      icon: Handshake,
      tone: 'purple',
      label: amountMode === 'weighted' ? 'Open pipeline (weighted)' : 'Open pipeline',
      value: formatCompactMoney(openPipeline, baseCurrency),
      unit: ` ${baseCurrency}`,
    },
    { icon: Briefcase, tone: 'yellow', label: 'Open deals', value: openCount },
    {
      icon: Trophy,
      tone: 'green',
      label: 'Won (this month)',
      value: formatCompactMoney(wonThisMonthAmount, baseCurrency),
      unit: ` ${baseCurrency}`,
    },
    {
      icon: Clock,
      tone: 'blue',
      label: 'Avg days in stage',
      value: avgDaysInStage.toFixed(1),
      unit: 'd',
    },
  ]

  // ---- gates ----
  if (!canViewOrganizations) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <GioEmptyState title="No access" description="You don't have permission to view the CRM." />
      </div>
    )
  }

  const hasActiveFilters = selectedOwners.length + selectedOrgs.length > 0 || !!searchQuery

  return (
    <div className="h-[100dvh] flex flex-col" style={{ background: '#F6F5F1' }}>
      <div className="flex-1 min-h-0 flex flex-col">
        <AppContainer variant="default" className="flex-1 min-h-0 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <PageHeader title="Deals" />
              <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-1 text-[13px] text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#12B886' }} />
                  <span className="font-medium text-text-primary tabular-nums">{openCount}</span>
                  <span>open</span>
                </span>
                <span className="text-text-tertiary">·</span>
                <span className="tabular-nums">{headerPipelineLabel}</span>
                <span className="text-text-tertiary">·</span>
                <span className="tabular-nums">{totalCount} deals total</span>
              </div>
            </div>
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New Deal
            </Button>
          </div>

          {/* KPI strip */}
          <div className="mt-4">
            <MetricStrip items={metrics} />
          </div>

          {/* Filter bar */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <FilterChipSelect
              label="Amount"
              value={amountMode}
              options={AMOUNT_MODE_OPTIONS}
              onChange={(v) => setAmountMode(v as DealAmountMode)}
            />
            <FilterChipPopover
              label="Owner"
              options={ownerOptions}
              selectedValues={selectedOwners}
              onSelectionChange={setSelectedOwners}
              searchable
            />
            <FilterChipPopover
              label="Company"
              options={orgOptions}
              selectedValues={selectedOrgs}
              onSelectionChange={setSelectedOrgs}
              searchable
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedOwners([])
                  setSelectedOrgs([])
                  setSearchQuery('')
                  setSearchOpen(false)
                }}
              >
                Clear
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {searchOpen ? (
                <div
                  className="flex items-center gap-1 h-9 px-2 rounded-lg bg-white"
                  style={{ border: '1px solid #E7E8EE' }}
                >
                  <SearchIcon className="h-3.5 w-3.5 text-text-tertiary" />
                  <Input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search deals or companies"
                    className={cn(
                      'h-7 w-[220px] border-0 bg-transparent px-1 text-[12.5px]',
                      'focus-visible:ring-0 focus-visible:ring-offset-0',
                    )}
                  />
                  <button
                    aria-label="Close search"
                    onClick={() => {
                      setSearchQuery('')
                      setSearchOpen(false)
                    }}
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" icon={SearchIcon} onClick={() => setSearchOpen(true)}>
                  Search
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={Settings2} disabled title="Coming soon">
                Customize
              </Button>
            </div>
          </div>

          {/* Board */}
          <div className="flex-1 min-h-0 mt-3">
            <DealsKanbanBoard
              onOpenDeal={setOpenDealId}
              amountMode={amountMode}
              selectedOwners={selectedOwners}
              selectedOrgs={selectedOrgs}
              searchQuery={searchQuery}
            />
          </div>
        </AppContainer>
      </div>

      <DealFormSheet open={creating} onOpenChange={setCreating} />
      <DealProfileSheet
        dealId={openDealId}
        open={!!openDealId}
        onOpenChange={(o) => !o && setOpenDealId(null)}
      />
    </div>
  )
}
