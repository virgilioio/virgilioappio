import * as React from 'react'
import { cn } from '@/lib/utils'
import { Sparkles, X, Info } from 'lucide-react'

/** Round avatar with initials — tone cycle by name hash. */
const AVATAR_TONES = [
  'bg-virgilio-purple text-white',
  'bg-sky-500 text-white',
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-indigo-500 text-white',
]
export function MemberAvatar({
  name,
  url,
  size = 32,
  className,
}: {
  name: string
  url?: string | null
  size?: number
  className?: string
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  const tone = AVATAR_TONES[
    Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_TONES.length
  ]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-poppins font-semibold',
        !url && tone,
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}

/** Role explanation tile (Hiring team / Roles on this job). */
const ROLE_TONE_CLASSES = {
  lilac: 'bg-[#EDE4FF] text-virgilio-purple',
  yellow: 'bg-[#FFF4C7] text-[#856404]',
  orange: 'bg-[#FFE2C7] text-[#9A4D00]',
  green: 'bg-[#D7F2DD] text-[#1B6B3A]',
  blue: 'bg-[#D7E6FF] text-[#1E4A8E]',
  pink: 'bg-[#FFD9E6] text-[#9B1F4F]',
} as const
export type RoleTone = keyof typeof ROLE_TONE_CLASSES
export function RoleCard({
  label,
  description,
  count,
  tone = 'lilac',
  active,
}: {
  label: string
  description: string
  count: number
  tone?: RoleTone
  active?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        active
          ? 'border-virgilio-border shadow-sm bg-[#FFFCF9]'
          : 'border-virgilio-border bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-poppins font-medium',
            ROLE_TONE_CLASSES[tone]
          )}
        >
          {label}
        </span>
        <span className="text-[14px] font-poppins font-semibold tabular-nums text-text-primary">
          {count}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-text-secondary">{description}</p>
    </div>
  )
}

/** Inline info link (section trailing). */
export function InfoLink({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary transition-colors"
    >
      <Info className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

/* ============================================================
 * Wizard shared building blocks — Gio Foundation, Job wizard v2
 * ============================================================ */

/** Section card — uppercase eyebrow heading + bordered card body */
export function SectionCard({
  title,
  trailing,
  children,
  className,
}: {
  title: string
  trailing?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-[11px] font-poppins font-semibold tracking-[0.12em] uppercase text-text-secondary">
          {title}
        </h3>
        {trailing}
      </div>
      <div className="rounded-2xl border border-virgilio-border bg-white p-5 sm:p-6 space-y-5">
        {children}
      </div>
    </section>
  )
}

/** Field label + optional required asterisk + optional helper hint */
export function FieldLabel({
  htmlFor,
  children,
  required,
  optional,
  className,
}: {
  htmlFor?: string
  children: React.ReactNode
  required?: boolean
  optional?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-poppins font-medium tracking-[-0.01em] text-text-primary',
        className
      )}
    >
      {children}
      {required && <span className="text-destructive">*</span>}
      {optional && <span className="text-text-tertiary font-normal">(optional)</span>}
    </label>
  )
}

/** Helper text shown below a field */
export function FieldHint({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <p
      className={cn(
        'text-[12px] mt-1.5',
        tone === 'error' ? 'text-destructive' : 'text-text-tertiary'
      )}
    >
      {children}
    </p>
  )
}

/** AI-assisted badge — purple pill with sparkle */
export function AiAssistedBadge({
  children = 'AI assisted',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[#EDE4FF] px-2.5 py-1 text-[11.5px] font-poppins font-medium text-virgilio-purple',
        className
      )}
    >
      <Sparkles className="h-3 w-3" />
      {children}
    </span>
  )
}

/** Generic segmented control (used for Status) */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex h-11 w-full items-center rounded-xl border border-virgilio-border bg-white p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 h-full rounded-lg text-[13px] font-poppins font-medium tracking-[-0.005em] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
              active
                ? 'bg-[#F6F5F1] text-text-primary shadow-[inset_0_0_0_1px_hsl(var(--border))]'
                : 'text-text-tertiary hover:text-text-primary'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** Toggle row — label + helper + switch on the right */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const id = React.useId()
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="text-[13px] font-poppins font-medium text-text-primary cursor-pointer"
        >
          {label}
        </label>
        {hint && (
          <p className="text-[12px] text-text-tertiary mt-0.5">{hint}</p>
        )}
      </div>
      {/* Native-feeling switch with project tokens */}
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
          checked ? 'bg-pastel-green-foreground' : 'bg-virgilio-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}

/** Chip input — used for additional locations & skills.
 *  Accepts comma / Enter to add; Backspace on empty removes last. */
export function ChipInput({
  values,
  onChange,
  placeholder = 'Type and press Enter…',
  tone = 'purple',
  className,
  inputClassName,
  maxChips,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  tone?: 'purple' | 'neutral'
  className?: string
  inputClassName?: string
  maxChips?: number
}) {
  const [draft, setDraft] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const commit = (raw: string) => {
    const v = raw.trim().replace(/,$/, '').trim()
    if (!v) return
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) return
    if (maxChips && values.length >= maxChips) return
    onChange([...values, v])
    setDraft('')
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  const toneCls =
    tone === 'purple'
      ? 'bg-[#EDE4FF] text-virgilio-purple'
      : 'bg-[#F6F5F1] text-text-primary border border-virgilio-border'

  return (
    <div
      className={cn(
        'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-virgilio-border bg-white px-2.5 py-2',
        'focus-within:ring-2 focus-within:ring-virgilio-purple/30',
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((v) => (
        <span
          key={v}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium',
            toneCls
          )}
        >
          {v}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(values.filter((x) => x !== v))
            }}
            className="rounded-full p-0.5 hover:bg-black/5"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => draft && commit(draft)}
        placeholder={values.length === 0 ? placeholder : ''}
        className={cn(
          'flex-1 min-w-[120px] bg-transparent text-[13px] outline-none placeholder:text-text-tertiary',
          inputClassName
        )}
      />
    </div>
  )
}

/** Salary input — leading currency symbol + value + trailing /yr suffix */
export function SalaryInput({
  symbol = '$',
  value,
  onChange,
  placeholder,
  suffix = '/yr',
  invalid,
}: {
  symbol?: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  suffix?: string
  invalid?: boolean
}) {
  const formatted = value == null || Number.isNaN(value) ? '' : value.toLocaleString('en-US')

  return (
    <div
      className={cn(
        'flex h-11 items-center rounded-xl border bg-white px-3 transition-colors',
        invalid
          ? 'border-destructive ring-2 ring-destructive/20'
          : 'border-virgilio-border focus-within:ring-2 focus-within:ring-virgilio-purple/30'
      )}
    >
      <span className="text-[13px] text-text-tertiary pr-2">{symbol}</span>
      <input
        inputMode="numeric"
        value={formatted}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, '')
          onChange(raw === '' ? undefined : Number(raw))
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[13px] tabular-nums outline-none placeholder:text-text-tertiary"
      />
      {suffix && (
        <span className="text-[12px] text-text-tertiary pl-2 whitespace-nowrap">{suffix}</span>
      )}
    </div>
  )
}
