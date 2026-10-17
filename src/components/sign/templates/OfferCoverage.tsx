import { useState } from 'react'
import { Check, ChevronDown, TriangleAlert } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { listLabels, offerCoverage, usedTags, useOfferFormTags, type TplDraft } from '@/lib/sign/templates'

/**
 * How many of the linked offer form's fields the template uses, with a list
 * where each unused field can be marked "Not needed" (2026-10-17). Not-needed
 * fields don't count as missing here, on the template card or when sending.
 */
export function OfferCoverage({
  d,
  set,
  verb,
  size = 'sm',
}: {
  d: TplDraft
  set: (fn: (d: TplDraft) => TplDraft) => void
  /** "placed" on the Fields step, "used" for written-only templates. */
  verb: 'placed' | 'used'
  size?: 'sm' | 'md'
}) {
  const formTags = useOfferFormTags(d.kind === 'candidate' ? d.offer_form_id : null)
  const [open, setOpen] = useState(false)
  if (d.kind !== 'candidate' || !d.offer_form_id || !formTags.data?.length) return null
  const c = offerCoverage(usedTags(d), formTags.data, d.not_needed)
  const toggle = (key: string, notNeeded: boolean) =>
    set((x) => ({ ...x, not_needed: notNeeded ? [...new Set([...x.not_needed, key])] : x.not_needed.filter((k) => k !== key) }))
  const text = size === 'md' ? 'text-[12.5px]' : 'text-[11.5px]'
  const unused = [...c.missing, ...c.skipped]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('flex gap-1.5 font-inter leading-snug', text, c.missing.length ? 'text-[#7A4A06]' : 'text-[#16704A]')}>
        {c.missing.length ? (
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        ) : (
          <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        <span className="min-w-0">
          {c.missing.length ? (
            <>
              <span className="tabular-nums">
                {c.placed.length} of {c.total}
              </span>{' '}
              offer fields {verb}. Not {verb}: {listLabels(c.missing.map((t) => t.label), 4)}.
            </>
          ) : (
            `Every offer field is ${verb}${c.skipped.length ? `, apart from ${c.skipped.length} marked not needed` : ''}.`
          )}{' '}
          {unused.length > 0 && (
            <CollapsibleTrigger className="inline-flex items-center gap-0.5 font-medium text-virgilio-purple underline-offset-2 hover:underline [&[data-state=open]>svg]:rotate-180">
              {c.missing.length ? 'Mark some not needed' : 'Change'}
              <ChevronDown className="gio-disclosure-chevron h-3 w-3" strokeWidth={2.2} aria-hidden />
            </CollapsibleTrigger>
          )}
        </span>
      </div>
      {unused.length > 0 && (
        <CollapsibleContent>
          <ul className="mt-2 flex flex-col gap-1 rounded-lg border border-[#ECEAE2] bg-[#FAFAF7] p-2">
            {unused.map((t) => {
              const skipped = d.not_needed.includes(t.key)
              return (
                <li key={t.key} className={cn('flex items-center gap-2 font-inter', text)}>
                  <span className={cn('min-w-0 flex-1 truncate', skipped ? 'text-text-tertiary line-through' : 'text-text-primary')}>{t.label}</span>
                  <button
                    type="button"
                    className="gio-pressable shrink-0 rounded-md px-1.5 py-0.5 font-medium text-virgilio-purple hover:bg-[#F3EDFE]"
                    aria-pressed={skipped}
                    onClick={() => toggle(t.key, !skipped)}
                  >
                    {skipped ? 'Needed after all' : 'Not needed'}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className={cn('mt-1.5 font-inter text-text-tertiary', size === 'md' ? 'text-[12px]' : 'text-[11px]')}>
            Fields marked not needed don’t count as missing when someone sends this template.
          </p>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
