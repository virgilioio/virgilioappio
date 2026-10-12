import { METRICS, MARKET_METRICS } from '../model/metrics'
import { MARKET_DIMENSIONS } from '../model/dimensions'
import { marketVizFor } from '../model/viz'
import type { WidgetConfig } from '../model/types'
import type { WidgetCatalog, WidgetSelection } from '../widgets/WidgetCatalog'
import { useMarketBundle } from './MarketDataContext'
import { useMarketWidgetData } from './useMarketWidgetData'

/** Click a bar, slice, row or country to filter the whole page by it. */
function useMarketSelection(cfg: WidgetConfig): WidgetSelection {
  const m = useMarketBundle()
  if (cfg.groupBy === 'none' || cfg.groupBy === 'time') return { selected: [] }
  return {
    selected: m.selections.filter(s => s.dimension === cfg.groupBy).map(s => s.value),
    onSelect: (label: string) => m.toggle({ dimension: cfg.groupBy, value: label }),
  }
}

/** The Intelligence page's widgets: the talent market over the whole database. */
export function marketCatalog(salaryCurrencies: string[]): WidgetCatalog {
  return {
    id: 'market',
    useData: useMarketWidgetData,
    useSelection: useMarketSelection,
    metricGroups: [{ label: 'Talent market · everyone in Gio', metrics: MARKET_METRICS }],
    dimensionsFor: () => MARKET_DIMENSIONS,
    vizFor: marketVizFor,
    newWidget: () => ({ id: crypto.randomUUID(), metric: 'mkt_people', groupBy: 'mkt_role_family', viz: 'bars', span: 6 }),
    owns: (m) => METRICS[m]?.group === 'market',
    salaryCurrencies,
  }
}
