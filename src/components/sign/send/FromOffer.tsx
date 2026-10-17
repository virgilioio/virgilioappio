import { Check, CircleX, Info, TriangleAlert } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { listLabels, tagLabel, type OfferFormTag } from '@/lib/sign/templates'
import { sendErrorMessage, type SendPreview, type SendTemplate } from '@/lib/sign/send'
import type { SignKind } from '@/lib/sign/api'
import { FieldRow, Note } from './parts'
import { useTemplateFit } from './fit'

const STANDARD_ORDER = ['name', 'job', 'salary', 'start', 'today', 'sender']

export function FromOffer({
  tpl,
  kind,
  isOffer,
  offerFormId,
  preview,
  previewLoading,
  previewError,
  onEditTemplate,
}: {
  tpl: SendTemplate
  kind: SignKind
  isOffer: boolean
  offerFormId: string | null
  preview: SendPreview | undefined
  previewLoading: boolean
  previewError: unknown
  /** Admins can open the template from the warning. */
  onEditTemplate?: () => void
}) {
  const fit = useTemplateFit(tpl, isOffer, offerFormId)
  const labelOf = (k: string, tags?: OfferFormTag[]) => tags?.find((t) => t.key === k)?.label ?? tagLabel(kind, k)
  const offerForm = fit.formName(offerFormId)

  if (fit.blocked) {
    const blocking = fit.cov?.blocking ?? []
    const labels = blocking.map((k) => labelOf(k, fit.tplTags))
    return (
      <>
        <Note tone="bad" icon={CircleX}>
          {labels.length
            ? `This template is linked to the ${fit.formName(tpl.offer_form_id)} form. It needs ${listLabels(labels, 4)}, which this offer doesn’t have, so it can’t be sent. Pick one linked to ${offerForm}.`
            : `This template is linked to the ${fit.formName(tpl.offer_form_id)} form, so it can’t be sent with this offer. Pick one linked to ${offerForm}.`}
        </Note>
        {labels.length > 0 && (
          <div className="flex flex-col">
            {labels.map((l) => (
              <FieldRow key={l} icon={CircleX} tone="bad" label={l}>
                The document needs this, and the {offerForm} offer doesn’t capture it
              </FieldRow>
            ))}
          </div>
        )}
      </>
    )
  }

  if (previewLoading) return <Skeleton className="h-24 rounded-lg" />
  if (previewError) return <p className="font-inter text-[12.5px] text-virgilio-error">{sendErrorMessage(previewError)}</p>

  const used = preview?.used ?? []
  const missingValues = preview?.missing ?? []
  const blank = preview?.blank ?? []
  const notInDoc = fit.linked ? fit.cov?.missing ?? [] : []
  const formOrder = new Map((fit.offerTags ?? []).map((t, i) => [t.key, i]))
  const rank = (k: string) => (STANDARD_ORDER.includes(k) ? STANDARD_ORDER.indexOf(k) - 100 : formOrder.get(k) ?? 1000)
  const mapped = [...used].sort((a, b) => rank(a.key) - rank(b.key))
  const label = (k: string, l?: string | null) => l || labelOf(k, fit.offerTags)

  return (
    <>
      {notInDoc.length > 0 && (
        <Note tone="warn" icon={TriangleAlert}>
          {notInDoc.length === 1 ? `${notInDoc[0].label} is` : `${notInDoc.length} offer fields are`} in the offer but not in the document. You can still send.{' '}
          {onEditTemplate ? (
            <>
              To add {notInDoc.length === 1 ? 'it' : 'them'},{' '}
              <button type="button" className="font-medium text-virgilio-purple underline-offset-2 hover:underline" onClick={onEditTemplate}>
                edit the template
              </button>
              .
            </>
          ) : (
            `An admin can add ${notInDoc.length === 1 ? 'it' : 'them'} to the template.`
          )}
        </Note>
      )}
      {missingValues.length > 0 && (
        <Note tone="bad" icon={CircleX}>
          {kind === 'member'
            ? `This template fills in ${listLabels(missingValues)}, which ${missingValues.length === 1 ? 'isn’t' : 'aren’t'} set for this person yet. Set it on their People page, then come back.`
            : `This template fills in ${listLabels(missingValues)}, which ${missingValues.length === 1 ? 'isn’t' : 'aren’t'} on the ${isOffer ? 'offer' : 'candidate’s offer'} yet. Add ${missingValues.length === 1 ? 'it' : 'them'} to the offer, then come back.`}
        </Note>
      )}
      {blank.length > 0 && (
        <Note tone="info" icon={Info}>
          {`${listLabels(blank)} ${blank.length === 1 ? 'is' : 'are'} optional on the offer form and empty on this offer, so ${blank.length === 1 ? 'it prints' : 'they print'} blank.`}
        </Note>
      )}
      {!notInDoc.length && !mapped.length ? (
        <p className="font-inter text-[12.5px] text-text-tertiary">This template doesn’t fill in anything from the {isOffer ? 'offer' : 'record'}.</p>
      ) : (
        <div className="flex flex-col">
          {notInDoc.map((t) => (
            <FieldRow key={`m-${t.key}`} icon={TriangleAlert} tone="warn" label={t.label}>
              In the offer, but not in the document
            </FieldRow>
          ))}
          {mapped.map((u) =>
            u.value ? (
              <FieldRow key={u.key} icon={Check} tone="ok" label={label(u.key, u.label)} clamp>
                {u.value}
              </FieldRow>
            ) : u.optional ? (
              <FieldRow key={u.key} icon={Info} tone="warn" label={label(u.key, u.label)}>
                Prints blank (optional)
              </FieldRow>
            ) : (
              <FieldRow key={u.key} icon={CircleX} tone="bad" label={label(u.key, u.label)}>
                Not on the {isOffer ? 'offer' : 'record'} yet
              </FieldRow>
            ),
          )}
        </div>
      )}
    </>
  )
}

