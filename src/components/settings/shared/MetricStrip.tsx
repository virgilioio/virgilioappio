import { cn } from '@/lib/utils'

export interface Metric {
  label: string
  value: string | number
  hint?: string
}

interface MetricStripProps {
  metrics: Metric[]
  className?: string
}

/**
 * Horizontal metric strip used at the top of Members, Billing, etc.
 * One card, columns separated by hairlines.
 */
export function MetricStrip({ metrics, className }: MetricStripProps) {
  return (
    <div
      className={cn(
        'bg-white border border-[#E7E8EE] rounded-xl overflow-hidden grid',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={cn(
            'px-5 py-4',
            i > 0 && 'border-l border-[#EFEFEA]'
          )}
        >
          <div
            className="font-inter font-semibold uppercase text-[#8B8F9E]"
            style={{ fontSize: '10px', letterSpacing: '0.08em' }}
          >
            {m.label}
          </div>
          <div
            className="font-poppins font-semibold text-[#0d0d09] mt-1.5 tabular-nums"
            style={{ fontSize: '22px', letterSpacing: '-0.03em', lineHeight: 1 }}
          >
            {m.value}
          </div>
          {m.hint && (
            <div className="font-inter text-[11.5px] text-[#5A6072] mt-1.5">
              {m.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
