import { useState } from 'react'
import { Check, Copy, Pencil, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconSwap } from '@/components/ui/icon-swap'
import { IconTip } from '@/components/ui/tooltip'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { cn } from '@/lib/utils'

/**
 * The member profile's building blocks (Allan, 2026-10-23: Deel's order, our
 * DNA). Every section is a card that reads first, as label → value rows, and
 * turns into its form only when someone presses Edit.
 */

export function ProfileCard({
  title,
  icon: Icon,
  aside,
  children,
  flush,
}: {
  title: string
  icon?: LucideIcon
  aside?: React.ReactNode
  children: React.ReactNode
  /** No inner padding: for tables and lists that run edge to edge. */
  flush?: boolean
}) {
  return (
    <section className="rounded-[12px] border border-[#E7E8EE] bg-white">
      <header className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[#EFEEEA] px-4 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 font-poppins text-[13.5px] font-semibold tracking-[-0.02em] text-[#1F2230]">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-[#6B7080]" strokeWidth={2} aria-hidden />}
          <span className="truncate">{title}</span>
        </h2>
        {aside}
      </header>
      <div className={flush ? '' : 'px-4 py-3'}>{children}</div>
    </section>
  )
}

/** Edit / Done in a card's header. */
export function EditToggle({ editing, onChange, label }: { editing: boolean; onChange: (v: boolean) => void; label: string }) {
  return editing ? (
    <Button variant="secondary" size="sm" onClick={() => onChange(false)}>
      Done
    </Button>
  ) : (
    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onChange(true)} aria-label={`Edit ${label}`}>
      Edit
    </Button>
  )
}

/** Label → value rows, one hairline between them. */
export function InfoRows({ children }: { children: React.ReactNode }) {
  return <dl className="-my-1 divide-y divide-[#F1F0EC]">{children}</dl>
}

export function InfoRow({
  label,
  hint,
  children,
  empty,
  stack,
}: {
  label: string
  hint?: string
  children?: React.ReactNode
  /** Shown faint when there's no value. */
  empty?: string
  /** Value under the label instead of beside it (chips, long text). */
  stack?: boolean
}) {
  const hasValue = children !== null && children !== undefined && children !== '' && children !== false
  return (
    <div className={cn('py-2.5 font-inter text-[12.5px]', stack ? 'space-y-1.5' : 'flex items-baseline justify-between gap-4')}>
      <dt className="shrink-0 text-[#6B7080]">
        {label}
        {hint && <span className="block text-[11.5px] text-[#8B8F9E]">{hint}</span>}
      </dt>
      <dd className={cn('min-w-0 text-[#1F2230]', !stack && 'text-right')}>
        {hasValue ? children : <span className="text-[#8B8F9E]">{empty ?? 'Not set'}</span>}
      </dd>
    </div>
  )
}

/** A value with a copy button beside it (§7 copy chips: the icon swaps to a tick for 1.6s). */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="inline-flex min-w-0 max-w-full items-center justify-end gap-1.5">
      <span className="truncate">{value}</span>
      <IconTip label={copied ? 'Copied' : `Copy ${label}`}>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            if (await copyToClipboardSilent(value)) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            }
          }}
          className="gio-pressable inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230]"
        >
          <IconSwap swapped={copied} from={<Copy size={13} />} to={<Check size={13} />} />
        </button>
      </IconTip>
    </span>
  )
}

/** Small read-only chips for a list of values (segments, specialties). */
export function ValueChips({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {values.map((v) => (
        <span key={v} className="rounded-full bg-[#F1F0EC] px-2.5 py-0.5 font-inter text-[12px] text-[#1F2230]">
          {v}
        </span>
      ))}
    </span>
  )
}
