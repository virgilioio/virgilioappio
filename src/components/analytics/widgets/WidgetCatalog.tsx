import { createContext, useContext, type ReactNode } from 'react'
import { METRICS, RECRUITING_METRICS, HYGIENE_METRICS, type MetricDef } from '../model/metrics'
import { SPLITTABLE_DIMENSIONS, type DimensionDef } from '../model/dimensions'
import { vizFor as recruitingVizFor, defaultSpan } from '../model/viz'
import { useWidgetData } from '../model/useWidgetData'
import type { DimensionId, MetricId, NormalizedData, VizId, WidgetConfig } from '../model/types'

/**
 * What a widget grid can show (Find Phase 4, 2026-10-12). Analytics and
 * Intelligence share the grid, the frame and the charts; each page provides
 * its own catalog: where the numbers come from, which metrics, splits and
 * charts are offered, and (on Intelligence) click-to-filter. Without a
 * provider the grid is Analytics, exactly as before.
 */
export interface WidgetSelection {
  /** Values of this widget's split that are selected on the page. */
  selected: string[]
  /** Toggle a value as a page filter; absent when the page has no click-to-filter. */
  onSelect?: (label: string) => void
}

export interface WidgetCatalog {
  id: 'analytics' | 'market'
  useData: (cfg: WidgetConfig) => NormalizedData
  useSelection: (cfg: WidgetConfig) => WidgetSelection
  metricGroups: { label: string; metrics: MetricDef[] }[]
  dimensionsFor: (metric: MetricId) => DimensionDef[]
  vizFor: (metric: MetricId, group: DimensionId) => VizId[]
  newWidget: () => WidgetConfig
  /** Whether a saved widget belongs on this page. */
  owns: (metric: MetricId) => boolean
  /** Salary display options (Intelligence). */
  salaryCurrencies?: string[]
}

const isHygiene = (m: MetricId) => METRICS[m]?.group === 'hygiene'
const noSelection = (): WidgetSelection => ({ selected: [] })

export const ANALYTICS_CATALOG: WidgetCatalog = {
  id: 'analytics',
  useData: useWidgetData,
  useSelection: noSelection,
  metricGroups: [
    { label: 'Recruiting', metrics: RECRUITING_METRICS },
    { label: 'Pipeline hygiene · current snapshot', metrics: HYGIENE_METRICS },
  ],
  dimensionsFor: (m) => (isHygiene(m)
    ? SPLITTABLE_DIMENSIONS.filter(d => d.id === 'stage' || d.id === 'job' || d.id === 'recruiter')
    : SPLITTABLE_DIMENSIONS),
  vizFor: (m, g) => recruitingVizFor(g, isHygiene(m)),
  newWidget: () => ({ id: crypto.randomUUID(), metric: 'applications', groupBy: 'none', viz: 'kpi', span: defaultSpan('kpi') }),
  owns: (m) => METRICS[m]?.group === 'recruiting' || METRICS[m]?.group === 'hygiene',
}

const Ctx = createContext<WidgetCatalog>(ANALYTICS_CATALOG)

export function WidgetCatalogProvider({ catalog, children }: { catalog: WidgetCatalog; children: ReactNode }) {
  return <Ctx.Provider value={catalog}>{children}</Ctx.Provider>
}

export function useWidgetCatalog(): WidgetCatalog {
  return useContext(Ctx)
}
