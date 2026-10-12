import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, LayoutGrid, MousePointerClick, Plus, RotateCcw, Upload, X } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { usePermissions } from '@/hooks/usePermissions'
import { useSavedViews, type SavedView } from '@/hooks/useSavedViews'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { AnalyticsViewSwitcher } from '@/components/analytics/AnalyticsViewSwitcher'
import { WidgetGrid } from '@/components/analytics/WidgetGrid'
import { WidgetCatalogProvider } from '@/components/analytics/widgets/WidgetCatalog'
import { MarketDataProvider, useMarketBundle } from '@/components/analytics/market/MarketDataContext'
import { marketCatalog } from '@/components/analytics/market/marketCatalog'
import { seedMarketWidgets } from '@/components/analytics/market/seedMarketView'
import { applySelections, companyLabel, SENIORITY_LABEL, type MarketSelection } from '@/components/analytics/market/marketData'
import { METRICS } from '@/components/analytics/model/metrics'
import { DIMENSIONS } from '@/components/analytics/model/dimensions'
import { VIZ, defaultSpan } from '@/components/analytics/model/viz'
import type { DimensionId, MetricId, VizId, WidgetConfig } from '@/components/analytics/model/types'
import { CandidatesEmpty } from '@/components/empty/CandidatesEmpty'
import { EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { IconTip } from '@/components/ui/tooltip'

/**
 * Intelligence (Find Phase 4, 2026-10-12): the talent market, on the same
 * widget grid as Analytics. Every widget reads the whole talent database
 * (everyone Find, the talent pool, applications and imports brought in),
 * not one period's pipeline. Click a bar, slice, row or country to filter
 * the page; views save widgets and filters, and "Market" is seeded for the
 * workspace.
 */

const SEED_NAME = 'Market'

interface ViewFilters { selections?: MarketSelection[] }
interface ExtraState { widgets?: WidgetConfig[] }

function sanitizeSelections(value: unknown): MarketSelection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((s): MarketSelection[] => {
    if (!s || typeof s !== 'object') return []
    const { dimension, value: v } = s as Partial<MarketSelection>
    return typeof dimension === 'string' && dimension in DIMENSIONS && DIMENSIONS[dimension as DimensionId].group === 'market' && typeof v === 'string'
      ? [{ dimension: dimension as DimensionId, value: v }]
      : []
  })
}

function sanitizeWidgets(value: unknown): WidgetConfig[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((raw): WidgetConfig[] => {
    if (!raw || typeof raw !== 'object') return []
    const w = raw as Partial<WidgetConfig>
    const metric = typeof w.metric === 'string' && METRICS[w.metric as MetricId]?.group === 'market' ? (w.metric as MetricId) : null
    if (!metric) return []
    const groupBy = typeof w.groupBy === 'string' && w.groupBy in DIMENSIONS ? (w.groupBy as DimensionId) : 'none'
    const viz = typeof w.viz === 'string' && w.viz in VIZ ? (w.viz as VizId) : 'kpi'
    const span = typeof w.span === 'number' && Number.isFinite(w.span) && w.span > 0 ? Math.min(12, Math.max(1, Math.round(w.span))) : defaultSpan(viz)
    return [{
      id: typeof w.id === 'string' && w.id ? w.id : crypto.randomUUID(),
      metric, groupBy, viz, span,
      title: typeof w.title === 'string' ? w.title : undefined,
      salaryPeriod: w.salaryPeriod === 'year' ? 'year' : w.salaryPeriod === 'month' ? 'month' : undefined,
      salaryCurrency: typeof w.salaryCurrency === 'string' ? w.salaryCurrency : undefined,
    }]
  })
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function TalentIntelligence() {
  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <IntelligencePage />
      </PermissionGate>
    </AuthGate>
  )
}

function IntelligencePage() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const { views, defaultView, createView, updateView } = useSavedViews('talent-intelligence')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [selections, setSelections] = useState<MarketSelection[]>([])

  // One shared "Market" view per workspace, seeded by whoever opens it first.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || !user || !tenant) return
    seededRef.current = true
    ;(async () => {
      const { data: existing } = await supabase
        .from('saved_views')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('page_context', 'talent-intelligence')
        .eq('visibility', 'shared')
        .eq('name', SEED_NAME)
        .limit(1)
      if (existing && existing.length > 0) return
      createView.mutate({
        name: SEED_NAME,
        filters: { selections: [] },
        extra_state: { widgets: seedMarketWidgets() },
        is_default: true,
        visibility: 'shared',
      })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenant?.id])

  const activateView = useCallback((v: SavedView) => {
    setActiveViewId(v.id)
    setSelections(sanitizeSelections((v.filters as ViewFilters | null)?.selections))
    // Views saved before the rebuild have no widgets: they open as Market.
    setWidgets(sanitizeWidgets((v.extra_state as ExtraState | null)?.widgets) ?? seedMarketWidgets())
  }, [])

  useEffect(() => {
    if (activeViewId) return
    const market = views.find(v => v.name === SEED_NAME && v.visibility === 'shared')
    const first = defaultView ?? market ?? views[0]
    if (first) activateView(first)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView?.id, views.length])

  // Save widgets and filters to the view (debounced; only views you own).
  const persistTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!activeViewId) return
    const active = views.find(v => v.id === activeViewId)
    if (!active || active.user_id !== user?.id) return
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      updateView.mutate({
        id: activeViewId,
        filters: { selections } as unknown as Record<string, unknown>,
        extra_state: { widgets } as unknown as Record<string, unknown>,
      })
    }, 600)
    return () => { if (persistTimer.current) window.clearTimeout(persistTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets, selections, activeViewId])

  const viewName = views.find(v => v.id === activeViewId)?.name ?? 'Intelligence'

  return (
    <MarketDataProvider selections={selections} onSelectionsChange={setSelections}>
      <IntelligenceBody
        viewName={viewName}
        activeViewId={activeViewId}
        onActivate={activateView}
        widgets={widgets}
        setWidgets={setWidgets}
        selections={selections}
        setSelections={setSelections}
      />
    </MarketDataProvider>
  )
}

function IntelligenceBody({
  viewName, activeViewId, onActivate, widgets, setWidgets, selections, setSelections,
}: {
  viewName: string
  activeViewId: string | null
  onActivate: (v: SavedView) => void
  widgets: WidgetConfig[]
  setWidgets: (next: WidgetConfig[] | ((prev: WidgetConfig[]) => WidgetConfig[])) => void
  selections: MarketSelection[]
  setSelections: (next: MarketSelection[]) => void
}) {
  const m = useMarketBundle()
  const navigate = useNavigate()
  const { canManageCandidates } = usePermissions()
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(m.loading, retry)
  const loadError = m.error && m.rows.length === 0 ? 'failed' : timedOut ? 'timeout' : null

  const currencies = useMemo(
    () => [m.baseCurrency, ...(m.baseCurrency !== 'USD' && m.rates.USD ? ['USD'] : [])],
    [m.baseCurrency, m.rates.USD],
  )
  const catalog = useMemo(() => marketCatalog(currencies), [currencies])

  const matching = useMemo(() => applySelections(m.rows, selections, m.ctx), [m.rows, selections, m.ctx])
  const withSalary = useMemo(() => matching.filter(r => typeof r.salary_month_base === 'number').length, [matching])

  const exportCsv = () => {
    const header = ['Country', 'State', 'City', 'Title', 'Role family', 'Seniority', 'Current company', 'Years of experience', `Salary per month (${m.baseCurrency})`, 'Source', 'Added']
    const lines = matching.map(r => [
      r.country, r.state, r.city, r.title, r.role_family,
      r.seniority ? SENIORITY_LABEL[r.seniority] ?? r.seniority : '',
      companyLabel(r.company), r.years_experience,
      typeof r.salary_month_base === 'number' ? Math.round(r.salary_month_base) : '',
      r.source, r.created_at.slice(0, 10),
    ].map(csvCell).join(','))
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gio-talent-market-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${matching.length.toLocaleString('en-US')} people`, { description: 'Market data only: no names or contact details.' })
  }

  const remove = (s: MarketSelection) => setSelections(selections.filter(x => !(x.dimension === s.dimension && x.value === s.value)))

  return (
    <div className="min-h-screen bg-[#F6F5F1]">
      <div className="mx-auto" style={{ maxWidth: 1320, padding: '26px 32px 48px' }}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="text-[11px] font-inter font-semibold tracking-[0.12em] uppercase text-[#8B8F9E] mb-1">
              INTELLIGENCE
            </div>
            <h1 className="font-poppins font-semibold text-[26px] tracking-[-0.045em] text-[#0d0d09] truncate">
              {viewName}<span className="text-[#D7C5FB]">.</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-inter text-[#5A6072] tabular-nums min-h-[18px]">
              {!m.loading && (
                <>
                  <span>{m.rows.length.toLocaleString('en-US')} people in Gio</span>
                  <span>Salaries for {m.rows.filter(r => typeof r.salary_month_base === 'number').length.toLocaleString('en-US')}</span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5"><LayoutGrid size={12} /> {widgets.length} widgets</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AnalyticsViewSwitcher
              pageContext="talent-intelligence"
              activeViewId={activeViewId}
              onActivate={v => v && onActivate(v)}
              currentFilters={{ selections } as unknown as Record<string, unknown>}
              currentExtraState={{ widgets }}
            />
            <button
              onClick={exportCsv}
              disabled={m.loading || matching.length === 0}
              className="gio-pressable inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#E7E8EE] bg-white hover:bg-[#FAFAF7] font-poppins font-medium text-[12.5px] text-[#0d0d09] disabled:opacity-50 whitespace-nowrap"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button
              onClick={() => setWidgets(w => [...w, catalog.newWidget()])}
              className="gio-pressable inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#6F3FF5] hover:bg-[#5B21B6] text-white font-poppins font-semibold text-[12.5px] transition-colors whitespace-nowrap"
            >
              <Plus size={13} />
              Add widget
            </button>
          </div>
        </div>

        {/* Click-to-filter chips, in reserved space so nothing jumps. */}
        <div className="mb-5 min-h-[32px] flex flex-wrap items-center gap-2">
          {selections.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-inter text-[#6B7080]">
              <MousePointerClick size={13} />
              Click any bar, slice, row or country to filter the whole page.
            </span>
          ) : (
            <>
              {selections.map(s => (
                <span key={`${s.dimension}:${s.value}`} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-[#EDE4FF] text-[#5B21B6] text-[12px] font-inter font-medium max-w-[280px]">
                  <span className="truncate">{DIMENSIONS[s.dimension]?.label}: {s.value}</span>
                  <IconTip label={`Remove ${s.value}`}>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      aria-label={`Remove ${s.value}`}
                      className="gio-pressable h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-[#D7C5FB]"
                    >
                      <X size={12} />
                    </button>
                  </IconTip>
                </span>
              ))}
              <span className="text-[12px] font-inter text-[#5A6072] tabular-nums">
                {matching.length.toLocaleString('en-US')} of {m.rows.length.toLocaleString('en-US')} people · {withSalary.toLocaleString('en-US')} with a salary
              </span>
              <button
                type="button"
                onClick={() => setSelections([])}
                className="gio-pressable inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[12px] font-inter font-medium text-[#5A6072] hover:bg-[#EDEAE2]"
              >
                <RotateCcw size={12} />
                Clear filters
              </button>
            </>
          )}
        </div>

        {loadError ? (
          <EmptyCard minHeight={360}>
            <LoadError
              what="your talent database"
              timedOut={loadError === 'timeout'}
              onRetry={() => { setRetry(n => n + 1); m.refetch() }}
            />
          </EmptyCard>
        ) : !m.loading && m.rows.length === 0 ? (
          <EmptyCard minHeight={360}>
            <CandidatesEmpty
              onceKey="talent-db"
              title="Your talent database is empty"
              body="Everyone you save from Find, the talent pool and applications shows up here as market data."
              primary={
                canManageCandidates
                  ? { label: 'Import candidates', icon: <Upload size={16} strokeWidth={2} />, onClick: () => navigate('/candidates?import=csv') }
                  : undefined
              }
            />
          </EmptyCard>
        ) : !m.loading && matching.length === 0 ? (
          <EmptyCard minHeight={360}>
            <CandidatesEmpty
              filtered
              onceKey="talent-db"
              title="No matches"
              body={`Nobody fits these filters together. The ${m.rows.length.toLocaleString('en-US')} people are still there, just hidden.`}
              primary={{ label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: () => setSelections([]) }}
            />
          </EmptyCard>
        ) : (
          <WidgetCatalogProvider catalog={catalog}>
            <WidgetGrid widgets={widgets} onChange={setWidgets} />
          </WidgetCatalogProvider>
        )}
      </div>
    </div>
  )
}
