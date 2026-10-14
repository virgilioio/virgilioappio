import type { ReactNode } from 'react'

import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

export interface ListTab<T extends string = string> {
  value: T
  label: string
  count?: number
  /** Extra mark after the label (e.g. a dot with a tooltip). */
  adornment?: ReactNode
}

/**
 * The tabs row at the top of a list card (Jobs, People). Motion & Feel §2/§14:
 * one layer slides between tabs; tabs never draw their own active fill.
 */
export function ListTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: ListTab<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  const segRef = useSegmentLayer<HTMLDivElement>()
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-virgilio-border">
      <div ref={segRef} role="tablist" aria-label={label} className="gio-seg inline-flex items-center gap-1">
        {tabs.map((t) => {
          const active = t.value === value
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-seg-option
              data-active={active || undefined}
              onClick={() => onChange(t.value)}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg whitespace-nowrap font-poppins text-[13.5px] tracking-[-0.01em] transition-colors duration-hover',
                active ? 'text-text-primary font-semibold' : 'text-text-tertiary hover:text-text-primary font-medium',
              )}
            >
              <span>{t.label}</span>
              {t.adornment}
              {t.count != null && t.count > 0 && (
                <span
                  className={cn(
                    'font-poppins text-[12.5px] tabular-nums',
                    active ? 'text-text-secondary' : 'text-text-tertiary/70',
                  )}
                >
                  ({t.count})
                </span>
              )}
            </button>
          )
        })}
        <SegmentLayer fill="#FAFAF7" />
      </div>
    </div>
  )
}
