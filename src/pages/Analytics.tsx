import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useSavedViews, type SavedView } from '@/hooks/useSavedViews'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { supabase } from '@/lib/supabaseClient'
import { Sparkles, LayoutGrid, Download, Plus, Loader2 } from 'lucide-react'
import { subDays } from 'date-fns'
import { AnalyticsDataProvider, type PageFilters } from '@/components/analytics/model/AnalyticsDataContext'
import { AnalyticsViewSwitcher } from '@/components/analytics/AnalyticsViewSwitcher'
import { AnalyticsFiltersToolbar } from '@/components/analytics/AnalyticsFiltersToolbar'
import { WidgetGrid } from '@/components/analytics/WidgetGrid'
import { SEED_RECRUITING_OVERVIEW, withFreshIds } from '@/components/analytics/seedDefaultViews'
import { defaultSpan } from '@/components/analytics/model/viz'
import type { WidgetConfig } from '@/components/analytics/model/types'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'
import { generateAnalyticsReport, type StageConversion } from '@/utils/analyticsReportGenerator'
import { useAnalyticsMetrics } from '@/hooks/useAnalyticsMetrics'
import { useStagePerformanceMetrics } from '@/hooks/analytics/useStagePerformanceMetrics'

const DEFAULT_FILTERS: PageFilters = {
  recruiterIds: [],
  jobIds: [],
  organizationIds: [],
  jobStatus: 'open',
}

interface ExtraState {
  widgets?: WidgetConfig[]
  dateRange?: { startISO: string; endISO: string }
}

export default function Analytics() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  const canAccessAnalytics = isPlatformAdmin || isWorkspaceOwner || isAdmin

  useEffect(() => {
    if (canAccessAnalytics === false) {
      toast({ title: 'Access Denied', description: 'Analytics is only available to administrators.', variant: 'destructive' })
      navigate('/dashboard')
    }
  }, [canAccessAnalytics, navigate, toast])

  const [dateRange, setDateRange] = useState<DateRange>({ startDate: subDays(new Date(), 30), endDate: new Date() })
  const [filters, setFilters] = useState<PageFilters>(DEFAULT_FILTERS)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])

  const { views, defaultView, createView, updateView } = useSavedViews('analytics')

  // One-shot seeder: if this user has no analytics views at all, create the two defaults.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    if (!user) return
    if (views.length > 0) return
    seededRef.current = true
    createView.mutate({
      name: 'Recruiting Overview',
      filters: DEFAULT_FILTERS as unknown as Record<string, unknown>,
      extra_state: { widgets: withFreshIds(SEED_RECRUITING_OVERVIEW) },
      is_default: true,
      visibility: 'shared',
    })
    createView.mutate({
      name: 'Sourcing & Quality',
      filters: DEFAULT_FILTERS as unknown as Record<string, unknown>,
      extra_state: { widgets: withFreshIds(SEED_SOURCING_QUALITY) },
      visibility: 'private',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, views.length])

  // Activate default view on first load
  useEffect(() => {
    if (activeViewId) return
    if (defaultView) {
      activateView(defaultView)
    } else if (views.length > 0) {
      activateView(views[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView?.id, views.length])

  const activateView = useCallback((v: SavedView) => {
    setActiveViewId(v.id)
    setFilters((v.filters as unknown as PageFilters) ?? DEFAULT_FILTERS)
    const extra = (v.extra_state ?? {}) as ExtraState
    setWidgets((extra.widgets ?? []).map(w => ({ ...w, span: w.span || defaultSpan(w.viz) })))
    if (extra.dateRange) {
      setDateRange({ startDate: new Date(extra.dateRange.startISO), endDate: new Date(extra.dateRange.endISO) })
    }
  }, [])

  // Persist widget layout + filters + date range whenever they change (debounced via micro-tick).
  const persistTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!activeViewId) return
    const active = views.find(v => v.id === activeViewId)
    if (!active || active.user_id !== user?.id) return // can't write shared views you don't own
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      const extra: ExtraState = {
        widgets,
        dateRange: { startISO: dateRange.startDate.toISOString(), endISO: dateRange.endDate.toISOString() },
      }
      updateView.mutate({
        id: activeViewId,
        filters: filters as unknown as Record<string, unknown>,
        extra_state: extra as unknown as Record<string, unknown>,
      })
    }, 600)
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets, filters, dateRange.startDate, dateRange.endDate, activeViewId])

  // Export PDF — we still need metrics for it
  const metrics = useAnalyticsMetrics({ dateRange, ...filters })
  const [isExporting, setIsExporting] = useState(false)
  const handleExport = async () => {
    setIsExporting(true)
    try {
      await generateAnalyticsReport({
        data: {
          applications: metrics.applications,
          activeCandidates: metrics.activeCandidates,
          totalOffers: (metrics as any).totalOffers ?? 0,
          totalHires: (metrics as any).totalHires ?? 0,
          interviewsScheduled: (metrics as any).interviewsScheduled ?? 0,
          interviewsCompleted: (metrics as any).interviewsCompleted ?? 0,
          rejectedCandidates: metrics.rejectedCandidates,
          statusDistribution: metrics.statusDistribution,
          stageDistribution: metrics.stageDistribution,
          trendData: metrics.trendData,
          interviewsByStage: [],
          stageConversions: [],
          avgTimePerStage: [],
        },
        dateRange,
      })
      toast({ title: 'Report exported' })
    } catch (e) {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }

  const currentExtraState = useMemo(() => ({ widgets }), [widgets])

  if (canAccessAnalytics === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[#6F3FF5] border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!canAccessAnalytics) return null

  return (
    <div className="min-h-screen bg-[#F6F5F1]">
      <div className="mx-auto" style={{ maxWidth: 1320, padding: '26px 32px 48px' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-[11px] font-inter font-semibold tracking-[0.12em] uppercase text-[#8B8F9E] mb-1">
              ANALYTICS
            </div>
            <h1 className="font-poppins font-semibold text-[26px] tracking-[-0.045em] text-[#0d0d09]">
              Recruiting analytics<span className="text-[#D7C5FB]">.</span>
            </h1>
            <div className="mt-2 flex items-center gap-3 text-[12px] font-inter text-[#5A6072]">
              <span className="inline-flex items-center gap-1.5"><LayoutGrid size={12} /> {widgets.length} widgets</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles size={12} /> Hover any card to configure, drag to rearrange</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AnalyticsViewSwitcher
              activeViewId={activeViewId}
              onActivate={v => v && activateView(v)}
              currentFilters={filters as unknown as Record<string, unknown>}
              currentExtraState={currentExtraState}
            />
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#E7E8EE] bg-white hover:bg-[#FAFAF7] font-poppins font-medium text-[12.5px] text-[#0d0d09] disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export
            </button>
            <button
              onClick={() => setWidgets(w => [...w, { id: crypto.randomUUID(), metric: 'applications', groupBy: 'none', viz: 'kpi', span: 3 }])}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#6F3FF5] hover:bg-[#5B21B6] text-white font-poppins font-semibold text-[12.5px] transition-colors"
            >
              <Plus size={13} />
              Add widget
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5">
          <AnalyticsFiltersToolbar
            filters={filters}
            onFiltersChange={setFilters}
            onDateRangeChange={(s, e) => setDateRange({ startDate: s, endDate: e })}
            initialTimePreset="last30d"
          />
        </div>

        {/* Grid */}
        <AnalyticsDataProvider dateRange={dateRange} filters={filters}>
          <WidgetGrid widgets={widgets} onChange={setWidgets} />
        </AnalyticsDataProvider>
      </div>
    </div>
  )
}
