import { coverage, useOfferFormTags, useOfferForms } from '@/lib/sign/templates'
import type { SendTemplate } from '@/lib/sign/send'

/**
 * Whether a template can go out with this offer, from what the browser knows:
 * it may only use the offer form's fields (and the always-available ones), and
 * a template linked to another form can't be sent from this offer (the
 * database refuses it, GSN16).
 */
export function useTemplateFit(tpl: SendTemplate | null, isOffer: boolean, offerFormId: string | null) {
  const offerTags = useOfferFormTags(isOffer ? offerFormId : null)
  const otherForm = !!tpl && isOffer && !!tpl.offer_form_id && tpl.offer_form_id !== offerFormId
  const tplTags = useOfferFormTags(otherForm ? tpl!.offer_form_id : null)
  const forms = useOfferForms()
  const cov = tpl && isOffer ? coverage(tpl, offerTags.data) : null
  const linked = !!tpl && isOffer && !!offerFormId && tpl.offer_form_id === offerFormId
  const blocked = !!tpl && isOffer && (otherForm || (cov?.blocking.length ?? 0) > 0)
  const formName = (id: string | null | undefined) => forms.data?.find((f) => f.id === id)?.name ?? 'another'
  return { cov, linked, blocked, otherForm, offerTags: offerTags.data, tplTags: tplTags.data, formName }
}
