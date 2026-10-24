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

export type CardTone = 'purple' | 'yellow' | 'green' | 'blue' | 'pink' | 'neutral'

/** The same tinted chips as the MetricStrip, so a card's icon and a strip's icon read as one family. */
const CARD_TONE: Record<CardTone, { bg: string; fg: string }> = {
  purple: { bg: '#EDE4FF', fg: '#6F3FF5' },
  yellow: { bg: '#FEF3C7', fg: '#B45309' },
  green: { bg: '#D1FAE5', fg: '#0F9F74' },
  blue: { bg: '#DBEAFE', fg: '#2563EB' },
  pink: { bg: '#FCE7F3', fg: '#BE185D' },
  neutral: { bg: '#F1F0EC', fg: '#1F2230' },
}

export function ProfileCard({
  title,
  icon: Icon,
  tone = 'purple',
  aside,
  children,
  flush,
  id,
}: {
  title: string
  icon?: LucideIcon
  /** The icon chip's tint. */
  tone?: CardTone
  aside?: React.ReactNode
  children: React.ReactNode
  /** No inner padding: for tables and lists that run edge to edge. */
  flush?: boolean
  /** An anchor, so a link can land on the card. */
  id?: string
}) {
  const t = CARD_TONE[tone]
  return (
    <section id={id} className="scroll-mt-24 overflow-clip rounded-[16px] border border-[#E7E8EE] bg-white">
      <header className="flex min-h-[64px] items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="flex min-w-0 items-center gap-3 font-poppins text-[15px] font-semibold tracking-[-0.02em] text-[#1F2230]">
          {Icon && (
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: t.bg, color: t.fg }}
              aria-hidden
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
            </span>
          )}
          <span className="truncate">{title}</span>
        </h2>
        {aside}
      </header>
      <div className={flush ? 'border-t border-[#EFEEEA]' : 'px-5 pb-5'}>{children}</div>
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
    <Button variant="ghost" size="sm" icon={Pencil} className="bg-[#F1F0EC]" onClick={() => onChange(true)} aria-label={`Edit ${label}`}>
      Edit
    </Button>
  )
}

/** Label → value rows, each on its own soft grey tile. */
export function InfoRows({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-col gap-1.5">{children}</dl>
}

/** A darker tile that names the rows under it ("Apps", "Seats"). */
export function InfoGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] bg-[#ECEAE2] px-3.5 py-2.5 font-inter text-[12.5px] font-medium text-[#1F2230]">{children}</div>
  )
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
    <div
      className={cn(
        'min-h-[44px] rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5 font-inter text-[12.5px]',
        stack ? 'space-y-1.5' : 'flex items-center justify-between gap-4',
      )}
    >
      <dt className="shrink-0 text-[#5A6072]">
        {label}
        {hint && <span className="block text-[11.5px] text-[#8B8F9E]">{hint}</span>}
      </dt>
      <dd className={cn('min-w-0 font-medium text-[#1F2230]', !stack && 'text-right')}>
        {hasValue ? children : <span className="font-normal text-[#8B8F9E]">{empty ?? 'Not set'}</span>}
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
