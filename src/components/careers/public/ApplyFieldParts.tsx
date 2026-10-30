import { cn } from '@/lib/utils'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'

/**
 * The careers application form's field parts (Motion & Feel §7).
 *
 * FieldMessage is the reserved 18px line under a field: empty until the field
 * has a problem, so a message appearing never moves the form; it enters 3px
 * down at --dur-hover (`.gio-field-message`).
 */
export function FieldMessage({ id, error }: { id?: string; error?: string | null }) {
  return (
    <p
      id={id}
      role={error ? 'alert' : undefined}
      className={cn('gio-field-message mt-1 text-xs', error && 'font-medium text-virgilio-error')}
      data-state={error ? 'error' : undefined}
      key={error ? `e:${error}` : 'idle'}
    >
      {error || null}
    </p>
  )
}

const YES_NO = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const

/**
 * A Yes / No question: two options under one sliding layer (§14). The answer is
 * stored as before ('true' / 'false'), so screening and older answers read the
 * same; nothing is picked until the candidate chooses.
 */
export function YesNoField({
  value,
  onChange,
  invalid,
  labelledBy,
  describedBy,
}: {
  value: string | undefined
  onChange: (value: 'true' | 'false') => void
  invalid?: boolean
  labelledBy?: string
  describedBy?: string
}) {
  const segRef = useSegmentLayer<HTMLDivElement>()
  return (
    <div
      ref={segRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        'gio-seg inline-flex rounded-[9px] p-[3px] gap-[2px] bg-[#ECEAE2]',
        invalid && 'shadow-[0_0_0_1px_hsl(var(--destructive))]',
      )}
    >
      {YES_NO.map((o, i) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            // The first option carries the error so a failed submit can focus and shake it.
            aria-invalid={i === 0 && invalid ? true : undefined}
            data-seg-option
            data-active={active || undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const next = o.value === 'true' ? 'false' : 'true'
                onChange(next)
                const sibling = (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[data-seg-option]') ?? [])[o.value === 'true' ? 1 : 0]
                sibling?.focus()
              }
            }}
            tabIndex={active || (!value && i === 0) ? 0 : -1}
            className={cn(
              'gio-pressable relative min-w-[84px] rounded-[7px] px-[14px] py-2 font-inter text-[13px] font-medium transition-colors duration-hover',
              active ? 'text-[#0D0D09]' : 'text-[#5A6072] hover:text-[#0D0D09]',
            )}
          >
            {o.label}
          </button>
        )
      })}
      <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.12)" />
    </div>
  )
}
