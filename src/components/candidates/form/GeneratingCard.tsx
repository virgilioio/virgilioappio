import React from 'react'
import { Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GeneratingCardProps {
  label: string
  /** "pills" = skeleton pills row (Skills); "lines" = skeleton paragraph lines (Summary) */
  variant: 'pills' | 'lines'
  className?: string
}

/**
 * Lilac "generating in background" card used by Skills and Profile Summary
 * while `enrich === 'working'`. Reads as actively-being-generated, never as
 * empty fields the user must fill.
 */
export function GeneratingCard({ label, variant, className }: GeneratingCardProps) {
  const pillWidths = ['68px', '92px', '54px', '110px', '76px', '88px', '62px']
  const lineWidths = ['100%', '97%', '92%', '58%']

  return (
    <div
      className={cn(
        'rounded-lg p-3 space-y-3',
        className,
      )}
      style={{ background: '#FAF8FF', boxShadow: 'inset 0 0 0 1px #EDE4FF' }}
    >
      <div className="flex items-center gap-2">
        <Sparkles
          className="h-3.5 w-3.5 gio-pulse"
          style={{ color: '#6F3FF5' }}
          strokeWidth={1.75}
        />
        <span
          className="font-poppins text-[12px] font-semibold"
          style={{ color: '#5B21B6' }}
        >
          {label}
        </span>
        <span
          className="gio-spinner"
          style={{ width: 12, height: 12 }}
          aria-hidden
        />
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-inter"
              style={{ color: '#8B8F9E' }}>
          <Zap className="h-3 w-3" strokeWidth={1.75} />
          Running in background
        </span>
      </div>

      {variant === 'pills' ? (
        <div className="flex flex-wrap gap-1.5">
          {pillWidths.map((w, i) => (
            <span
              key={i}
              className="gio-skeleton rounded-full"
              style={{ width: w, height: 22 }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {lineWidths.map((w, i) => (
            <span
              key={i}
              className="gio-skeleton block rounded-[5px]"
              style={{ width: w, height: 10 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default GeneratingCard
