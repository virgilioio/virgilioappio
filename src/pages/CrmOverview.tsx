import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { startOfMonth, startOfQuarter, startOfYear, subDays } from 'date-fns'
import { ArrowUpRight, SlidersHorizontal, X, CalendarDays, ChevronDown } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { AnalyticsDataProvider, useAnalyticsBundle, type PageFilters } from '@/components/analytics/model/AnalyticsDataContext'
import { WidgetFrame } from '@/components/analytics/widgets/WidgetFrame'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fmt } from '@/components/analytics/model/format'
import type { WidgetConfig } from '@/components/analytics/model/types'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

type Preset = 'last30d' | 'last90d' | 'thisQuarter' | 'thisYear'

const PRESET_LABEL: Record<Preset, string> = {
  last30d: 'Last 30 days',
  last90d: 'Last 90 days',
  thisQuarter: 'This quarter',
  thisYear: 'This year',
}

function rangeFor(p: Preset): DateRange {
  const end = new Date()
  switch (p) {
    case 'last30d': return { startDate: subDays(end, 30), endDate: end }
    case 'last90d': return { startDate: subDays(end, 90), endDate: end }
    case 'thisQuarter': return { startDate: startOfQuarter(end), endDate: end }
    case 'thisYear': return { startDate: startOfYear(end), endDate: end }
  }
}

const OVERVIEW_WIDGETS: WidgetConfig[] = [
  { id: 'open_pipeline', metric: 'open_pipeline', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: 'revenue_won', metric: 'revenue_won', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: 'win_rate', metric: 'win_rate', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: 'avg_sales_cycle', metric: 'avg_sales_cycle', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: 'open_by_stage', metric: 'open_deals', groupBy: 'deal_stage', viz: 'funnel', span: 6, title: 'Open deals by stage' },
  { id: 'revenue_over_time', metric: 'revenue_won', groupBy: 'time', viz: 'line', span: 6, title: 'Revenue won over time' },
]

function useCrmFilterOptions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['crm-overview-filter-options', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const sb = supabase as any
      const { data: m } = await sb
        .from('members').select('tenant_id').eq('user_id', user!.id).eq('user_status', 'active').maybeSingle()
      const tenantId = m?.tenant_id
      if (!tenantId) return { owners: [], companies: [], stages: [] }

      const [{ data: owners }, { data: orgs }, { data: stages }] = await Promise.all([
        sb.from('members')
          .select('user_id, profiles!inner(id, first_name, last_name, email)')
          .eq('tenant_id', tenantId).eq('user_status', 'active'),
        sb.from('organizations').select('id, name').eq('tenant_id', tenantId).order('name'),
        sb.from('deal_stages').select('id, name, position').eq('tenant_id', tenantId).order('position'),
      ])
      const ownerOpts: FilterChipOption[] = (owners ?? []).map((r: any) => {
        const p = r.profiles
        const label = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || p?.email || 'Unknown'
        return { value: p?.id ?? r.user_id, label, count: 0 }
      })
      const companyOpts: FilterChipOption[] = (orgs ?? []).map((o: any) => ({ value: o.id, label: o.name, count: 0 }))
      const stageOpts: FilterChipOption[] = (stages ?? []).map((s: any) => ({ value: s.id, label: s.name, count: 0 }))
      return { owners: ownerOpts, companies: companyOpts, stages: stageOpts }
    },
  })
}

function DateRangePill({ value, onChange }: { value: Preset; onChange: (p: Preset) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[999px] bg-[#EDE4FF] border border-[#D7C5FB] font-poppins font-medium text-[12.5px] text-[#5B21B6]">
          <CalendarDays size={13} />
          {PRESET_LABEL[value]}
          <ChevronDown size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5">
        {(['last30d', 'last90d', 'thisQuarter', 'thisYear'] as Preset[]).map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-full text-left h-8 px-2 rounded-[7px] text-[12.5px] font-inter ${
              value === p ? 'bg-[#EDE4FF] text-[#5B21B6] font-medium' : 'text-[#1F2230] hover:bg-[#F4F3EF]'
            }`}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function MetaLine() {
  const b = useAnalyticsBundle()
  const open = b.crm.values.openDeals
  const pipeline = fmt(b.crm.values.openPipeline, 'money', b.crm.baseCurrency)
  return (
    <div className="mt-2 flex items-center gap-2 text-[12px] font-inter text-[#5A6072]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#12B886]" />
        {open} open deal{open === 1 ? '' : 's'}
      </span>
      <span className="text-[#D8D5CC]">·</span>
      <span>{pipeline} in pipeline</span>
    </div>
  )
}

function ReadonlyGrid() {
  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      {OVERVIEW_WIDGETS.map(w => (
        <div key={w.id} style={{ gridColumn: `span ${w.span} / span ${w.span}` }}>
          <WidgetFrame
            cfg={w}
            onChange={() => {}}
            onRemove={() => {}}
            readonly
          />
        </div>
      ))}
    </div>
  )
}

export default function CrmOverview() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<Preset>('thisQuarter')
  const dateRange = useMemo(() => rangeFor(preset), [preset])

  const [ownerIds, setOwnerIds] = useState<string[]>([])
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [stageIds, setStageIds] = useState<string[]>([])

  const { data: opts } = useCrmFilterOptions()
  const owners = opts?.owners ?? []
  const companies = opts?.companies ?? []
  const stages = opts?.stages ?? []

  const activeCount =
    (ownerIds.length > 0 ? 1 : 0) +
    (companyIds.length > 0 ? 1 : 0) +
    (stageIds.length > 0 ? 1 : 0)
  const clearAll = () => { setOwnerIds([]); setCompanyIds([]); setStageIds([]) }

  const pageFilters: PageFilters = {
    recruiterIds: [],
    jobIds: [],
    organizationIds: [],
    jobStatus: 'all',
    dealOwnerIds: ownerIds,
    dealCompanyIds: companyIds,
    dealStageIds: stageIds,
  }

  // Reset scroll on mount
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="min-h-screen bg-[#F6F5F1]">
      <AnalyticsDataProvider dateRange={dateRange} filters={pageFilters}>
        <div className="mx-auto" style={{ maxWidth: 1320, padding: '26px 32px 48px' }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="font-poppins font-semibold text-[26px] tracking-[-0.045em] text-[#0d0d09]">
                Overview<span className="text-[#D7C5FB]">.</span>
              </h1>
              <MetaLine />
              <div className="mt-1 text-[12px] font-inter text-[#8B8F9E]">
                {PRESET_LABEL[preset]}
              </div>
            </div>
            <button
              onClick={() => navigate('/analytics')}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#E7E8EE] bg-white hover:bg-[#FAFAF7] font-poppins font-medium text-[12.5px] text-[#0d0d09]"
            >
              <ArrowUpRight size={13} />
              Full report in Analytics
            </button>
          </div>

          {/* Filters */}
          <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-[999px] border border-[#E7E8EE] bg-white font-poppins font-medium text-[12.5px] text-[#5A6072]">
                <SlidersHorizontal size={13} />
                Filters
                {activeCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-[#EDE4FF] text-[#5B21B6] text-[10.5px] font-semibold">
                    {activeCount}
                  </span>
                )}
              </div>
              <FilterChipPopover label="Owner" options={owners} selectedValues={ownerIds} onSelectionChange={setOwnerIds} />
              <FilterChipPopover label="Company" options={companies} selectedValues={companyIds} onSelectionChange={setCompanyIds} />
              <FilterChipPopover label="Stage" options={stages} selectedValues={stageIds} onSelectionChange={setStageIds} />
              {activeCount > 0 && (
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 h-8 px-2 rounded-[7px] text-[12px] font-inter text-[#5A6072] hover:bg-[#F1F0EC]"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <DateRangePill value={preset} onChange={setPreset} />
          </div>

          {/* Widgets */}
          <ReadonlyGrid />

          {/* Footer banner */}
          <button
            onClick={() => navigate('/analytics')}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 h-12 rounded-[12px] border border-dashed border-[#D7C5FB] bg-[#FAF7FF] hover:bg-[#F4ECFF] font-poppins font-medium text-[13px] text-[#5B21B6] transition-colors"
          >
            See win rate, sales cycle, collections & owner breakdowns in Analytics
            <ArrowUpRight size={14} />
          </button>
        </div>
      </AnalyticsDataProvider>
    </div>
  )
}
