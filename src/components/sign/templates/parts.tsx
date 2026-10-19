import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

/** A segmented radio group on the shared sliding layer (Motion & Feel §14). */
export function Seg<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: LucideIcon }[]
  disabled?: boolean
}) {
  const ref = useSegmentLayer<HTMLDivElement>()
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className="gio-seg relative inline-flex w-fit self-start rounded-[10px] bg-[#ECEAE2] p-[3px]"
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value)
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (!d) return
        e.preventDefault()
        const next = options[(i + d + options.length) % options.length]
        onChange(next.value)
        ;(e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus()
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-value={o.value}
            data-seg-option
            data-active={on || undefined}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative z-[1] inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 font-poppins text-[13px] font-medium transition-colors duration-hover',
              on ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            {o.label}
          </button>
        )
      })}
      <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.12)" />
    </div>
  )
}

/** Label above a control, with an optional help line under it. */
export function Field({
  label,
  required,
  optional,
  help,
  htmlFor,
  children,
  className,
}: {
  label: string
  required?: boolean
  optional?: boolean
  help?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="font-inter text-[12.5px] font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-virgilio-error">*</span>}
        {optional && <span className="ml-1 font-normal text-text-tertiary">(optional)</span>}
      </label>
      {children}
      {help && <p className="font-inter text-[11.5px] leading-snug text-text-tertiary">{help}</p>}
    </div>
  )
}

/** A {{tag}} written into text, shown as a small chip with its label. */
export function TagText({ text, label }: { text: string; label: (key: string) => string }) {
  const parts = text.split(/(\{\{\w+\}\})/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\{\{(\w+)\}\}$/.exec(p)
        return m ? (
          <span
            key={i}
            className="mx-px inline-flex items-center rounded-[5px] border border-[#E2D6FC] bg-[#F6F1FE] px-1.5 align-baseline text-[0.92em] font-medium leading-[1.45] text-[#4C1D95]"
          >
            {label(m[1])}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}
