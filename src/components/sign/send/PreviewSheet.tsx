import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'

import { FormSheet } from '@/components/references/FormSheet'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SendTemplate } from '@/lib/sign/send'
import { FilledPreview } from '../FilledPreview'

/**
 * What the first signer will see (2026-10-17): every document in the order
 * it's signed, filled in with this record's values. Written documents come
 * from the same renderer that makes the PDF that is sent, with each value
 * underlined in lilac and empty ones shown as [Label]. Stacks on top of the
 * Send sheet, which steps back; Esc, Back or the dim close only this sheet.
 */
export function PreviewSheet({
  open,
  onOpenChange,
  tpl,
  firstName,
  isOffer,
  values,
  labels,
  people,
  issue,
  busy,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tpl: SendTemplate
  firstName: string
  isOffer: boolean
  values: Record<string, string | null | undefined>
  /** Labels by value key, for empty values ("[Bonus]"). */
  labels: Record<string, string>
  people: Record<string, { name: string }>
  /** Why it can't be sent yet, or null. */
  issue: string | null
  busy: boolean
  onSend: () => void
}) {
  const canvas = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const el = canvas.current
    if (!open || !el) return
    const ro = new ResizeObserver(() => setWidth(Math.max(260, Math.min(600, el.clientWidth - 48))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const who = firstName === 'them' ? 'the first signer' : firstName
  const subtitle = `Filled with ${firstName === 'them' ? 'this' : `${firstName}’s`} ${isOffer ? 'offer' : 'record'}. Underlined values come from the ${isOffer ? 'offer' : 'record'}.${
    tpl.docs > 1 ? ` ${tpl.docs} documents, in the order they’re signed.` : ''
  }`

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      width={760}
      stacked
      flush
      ariaLabel="Preview agreement"
      eyebrow={`Preview · what ${who} will see`}
      title={tpl.name}
      subtitle={subtitle}
      headerLead={
        <IconTip label="Back">
          <Button variant="ghost" size="sm" iconOnly aria-label="Back" className="-ml-2 mt-[2px] shrink-0" onClick={() => onOpenChange(false)} disabled={busy}>
            <ArrowLeft />
          </Button>
        </IconTip>
      }
      footer={
        <div className="flex w-full items-center gap-2.5">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => onOpenChange(false)} disabled={busy}>
            Back
          </Button>
          <p key={issue ?? 'ready'} className={cn('gio-swap-in min-w-0 flex-1 truncate font-inter text-[11.5px] text-text-tertiary')}>
            {issue ?? ''}
          </p>
          <Button icon={Send} onClick={onSend} disabled={!!issue} loading={busy} className="min-w-[168px]">
            Looks right · send
          </Button>
        </div>
      }
    >
      <div ref={canvas} className="min-h-full bg-[#ECEAE2] p-6">
        {open && <FilledPreview templateId={tpl.id} values={values} people={people} width={width} highlight={labels} />}
      </div>
    </FormSheet>
  )
}
