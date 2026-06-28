import { useEffect, useRef, useState } from 'react'
import { GripVertical, Maximize2, Settings2, Trash2, X, Check } from 'lucide-react'
import { METRICS, RECRUITING_METRICS, CRM_METRICS } from '../model/metrics'
import { DIMENSIONS, SPLITTABLE_DIMENSIONS } from '../model/dimensions'
import { VIZ, vizFor, defaultSpan, nextSpan } from '../model/viz'
import { TONE_COLOR, TONE_TINT } from '../model/tokens'
import { useWidgetData } from '../model/useWidgetData'
import { KpiChart } from './charts/KpiChart'
import { LineChart } from './charts/LineChart'
import { BarsChart } from './charts/BarsChart'
import { ColumnsChart } from './charts/ColumnsChart'
import { DonutChart } from './charts/DonutChart'
import { FunnelChart } from './charts/FunnelChart'
import { TableViz } from './charts/TableViz'
import type { WidgetConfig, DimensionId, VizId, MetricId } from '../model/types'

interface Props {
  cfg: WidgetConfig
  onChange: (next: WidgetConfig) => void
  onRemove: () => void
  dragHandleProps?: Record<string, unknown>
  isDragging?: boolean
  readonly?: boolean
}

function autoTitle(cfg: WidgetConfig): string {
  if (cfg.title) return cfg.title
  const m = (METRICS[cfg.metric] ?? METRICS.applications).label
  if (cfg.groupBy === 'none') return m
  if (cfg.groupBy === 'time') return `${m} over time`
  return `${m} by ${(DIMENSIONS[cfg.groupBy] ?? DIMENSIONS.none).label.toLowerCase()}`
}

function subLine(cfg: WidgetConfig): string {
  const v = (VIZ[cfg.viz] ?? VIZ.kpi).label
  if (cfg.groupBy === 'none') return v
  return `${v} · by ${(DIMENSIONS[cfg.groupBy] ?? DIMENSIONS.none).label.toLowerCase()}`
}

export function WidgetFrame({ cfg, onChange, onRemove, dragHandleProps, isDragging, readonly }: Props) {
  const meta = METRICS[cfg.metric] ?? METRICS.applications
  const Icon = meta.icon
  const tone = TONE_COLOR[meta.tone]
  const tint = TONE_TINT[meta.tone]
  const [configOpen, setConfigOpen] = useState(false)
  const data = useWidgetData(cfg)

  return (
    <div
      className="group relative bg-white rounded-[14px] border border-[#E7E8EE] hover:border-[#D7C5FB] transition-colors p-4 h-full flex flex-col"
      style={{ opacity: isDragging ? 0.4 : 1, outline: isDragging ? '1.5px dashed #D7C5FB' : 'none', outlineOffset: '-2px' }}
    >
      {/* Hover toolbar */}
      {!readonly && (
      <div className={`absolute top-2 right-2 ${configOpen ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5 bg-white border border-[#E7E8EE] rounded-[9px] p-0.5 shadow-[0_4px_12px_-4px_rgba(13,13,9,0.08)]`}>
        <button {...(dragHandleProps ?? {})} className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] text-[#5A6072] hover:bg-[#F1F0EC] cursor-grab active:cursor-grabbing" aria-label="Drag">
          <GripVertical size={13} />
        </button>
        <button onClick={() => onChange({ ...cfg, span: nextSpan(cfg.viz, cfg.span) })} className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] text-[#5A6072] hover:bg-[#F1F0EC]" aria-label="Resize">
          <Maximize2 size={13} />
        </button>
        <button onClick={() => setConfigOpen(o => !o)} className={`h-6 w-6 inline-flex items-center justify-center rounded-[6px] hover:bg-[#F1F0EC] ${configOpen ? 'bg-[#EDE4FF] text-[#5B21B6]' : 'text-[#5A6072]'}`} aria-label="Configure">
          <Settings2 size={13} />
        </button>
        <button onClick={onRemove} className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] text-[#FA5252] hover:bg-[#FBE0E0]" aria-label="Remove">
          <Trash2 size={13} />
        </button>
      </div>
      )}


      {/* Header */}
      <div className={`flex items-start gap-2.5 mb-3 min-h-[30px] ${readonly ? '' : 'pr-24'}`}>
        <div className="h-[30px] w-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: tint, color: tone }}>
          <Icon size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-poppins font-semibold text-[13.5px] tracking-[-0.01em] text-[#0d0d09] truncate" title={autoTitle(cfg)}>
            {autoTitle(cfg)}
          </div>
          <div className="text-[11px] font-inter text-[#8B8F9E] flex items-center gap-1.5">
            <span>{subLine(cfg)}</span>
            {cfg.scope && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-[10px] bg-[#EDE4FF] text-[#5B21B6] text-[10px] font-medium">
                <span className="h-1 w-1 rounded-full bg-[#5B21B6]" />
                {cfg.scope.value}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {data.loading ? (
          <div className="h-full min-h-[60px] flex items-center justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-[#E7E8EE] border-t-[#6F3FF5] animate-spin" />
          </div>
        ) : data.empty ? (
          <div className="h-full min-h-[60px] flex items-center justify-center text-[12px] font-inter text-[#8B8F9E]">
            No data in this range
          </div>
        ) : (
          renderViz(cfg, data)
        )}
      </div>

      {configOpen && (
        <ConfigPopover cfg={cfg} onChange={onChange} onClose={() => setConfigOpen(false)} />
      )}
    </div>
  )
}

function renderViz(cfg: WidgetConfig, data: ReturnType<typeof useWidgetData>) {
  switch (cfg.viz) {
    case 'kpi':
      return <KpiChart metricId={cfg.metric} data={data} />
    case 'line':
      return <LineChart metricId={cfg.metric} series={data.series} />
    case 'bars':
      return <BarsChart metricId={cfg.metric} data={data.breakdown} format={data.format} currency={data.currency} />
    case 'columns':
      return <ColumnsChart data={data.breakdown} format={data.format} currency={data.currency} />
    case 'donut':
      return <DonutChart data={data.breakdown} />
    case 'funnel':
      return <FunnelChart metricId={cfg.metric} data={data.breakdown} format={data.format} currency={data.currency} />
    case 'table':
      return <TableViz dimensionLabel={DIMENSIONS[cfg.groupBy].label} data={data.breakdown} format={data.format} currency={data.currency} />
  }
}

function ConfigPopover({ cfg, onChange, onClose }: { cfg: WidgetConfig; onChange: (c: WidgetConfig) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const validViz = vizFor(cfg.groupBy)

  const setMetric = (id: MetricId) => onChange({ ...cfg, metric: id })
  const setGroup = (id: DimensionId) => {
    const allowed = vizFor(id)
    const nextViz = allowed.includes(cfg.viz) ? cfg.viz : allowed[0]
    const nextSp = allowed.includes(cfg.viz) ? cfg.span : defaultSpan(nextViz)
    onChange({ ...cfg, groupBy: id, viz: nextViz, span: nextSp, scope: undefined, title: undefined })
  }
  const setViz = (id: VizId) => onChange({ ...cfg, viz: id, span: defaultSpan(id) })

  return (
    <div
      ref={ref}
      className="absolute top-10 right-2 z-30 w-[268px] bg-white rounded-[12px] border border-[#E7E8EE] shadow-[0_12px_32px_-8px_rgba(13,13,9,0.18)] p-3"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-poppins font-semibold text-[12.5px] text-[#0d0d09]">Configure widget</div>
        <button onClick={onClose} className="text-[#8B8F9E] hover:text-[#0d0d09]" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <Section label="Metric">
        <GroupedDropdown
          value={cfg.metric}
          groups={[
            { label: 'Recruiting', options: RECRUITING_METRICS.map(m => ({ value: m.id, label: m.label })) },
            { label: 'CRM / Revenue', options: CRM_METRICS.map(m => ({ value: m.id, label: m.label })) },
          ]}
          onChange={v => setMetric(v as MetricId)}
        />
      </Section>

      <Section label="Split by">
        <Dropdown
          value={cfg.groupBy}
          options={[
            { value: 'none', label: 'No split' },
            ...SPLITTABLE_DIMENSIONS.map(d => ({ value: d.id, label: `By ${d.label.toLowerCase()}` })),
          ]}
          onChange={v => setGroup(v as DimensionId)}
        />
      </Section>

      <Section label="Visualization">
        <div className="flex flex-wrap gap-1">
          {validViz.map(v => {
            const def = VIZ[v]
            const Icon = def.icon
            const active = cfg.viz === v
            return (
              <button
                key={v}
                onClick={() => setViz(v)}
                className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-[7px] text-[11.5px] font-inter font-medium transition-colors ${
                  active ? 'bg-[#EDE4FF] text-[#5B21B6]' : 'bg-[#F4F3EF] text-[#1F2230] hover:bg-[#EDEAE2]'
                }`}
              >
                <Icon size={12} />
                {def.label}
                {active && <Check size={11} />}
              </button>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] font-inter font-medium uppercase tracking-[0.06em] text-[#8B8F9E] mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Dropdown({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-8 px-2 rounded-[7px] border border-[#E7E8EE] bg-white text-[12.5px] font-inter text-[#0d0d09] focus:outline-none focus:ring-2 focus:ring-[#6F3FF5]/30"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function GroupedDropdown({
  value,
  groups,
  onChange,
}: {
  value: string
  groups: { label: string; options: { value: string; label: string }[] }[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-8 px-2 rounded-[7px] border border-[#E7E8EE] bg-white text-[12.5px] font-inter text-[#0d0d09] focus:outline-none focus:ring-2 focus:ring-[#6F3FF5]/30"
    >
      {groups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
