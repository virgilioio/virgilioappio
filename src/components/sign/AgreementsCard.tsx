import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, FileSignature, MoreHorizontal, PenLine } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { ENVELOPE_STATUS, ago, agoInline, shortDateTime, signersOf } from '@/lib/sign/status'
import { SIGN_SENDING_LIVE, offerSendRefusal, useOfferGate, useRecordEnvelopes, type SendSource } from '@/lib/sign/send'
import { sealStuck, type EnvelopeRow } from '@/lib/sign/api'
import { SendSheet, type SendDraft } from './SendSheet'
import { useEnvelopeActions } from './envelopeActions'
import { useAuth } from '@/contexts/AuthContext'
import { IconTip } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function AgreementLine({ e }: { e: EnvelopeRow }) {
  const st = ENVELOPE_STATUS[e.status]
  const signers = signersOf(e)
  const done = signers.filter((r) => r.status === 'signed').length
  const meta =
    e.status === 'scheduled' && e.scheduled_at
      ? `Sends ${shortDateTime(e.scheduled_at)}`
      : e.status === 'sent'
      ? `${done}/${signers.length} signed · ${ago(e.sent_at ?? e.updated_at)}`
      : e.status === 'completed' && e.completed_at
      ? `Signed ${agoInline(e.completed_at)}${e.sealed_path ? '' : sealStuck(e) ? ' · couldn’t seal' : ' · sealing…'}`
      : ago(e.updated_at)
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 font-inter text-[12.5px] font-medium text-[#1F2230]">
          <span className="truncate">{e.title}</span>
          {e.offer_id && (
            <Badge tone="lilac" size="xs">
              Offer
            </Badge>
          )}
        </p>
        <p className="mt-0.5 truncate font-inter text-[11.5px] tabular-nums text-[#6B7080]">
          {meta}
          {e.out_of_date && <span className="text-[#B45309]"> · the offer changed after this went out</span>}
        </p>
      </div>
      <Badge tone={st.tone} size="xs" dot>
        {st.label}
      </Badge>
    </div>
  )
}

/**
 * Agreements on a record: every envelope sent for it, live, and Send for
 * signature. On a candidate it's per job (the job's team sees it); in People &
 * Access it's per member. Admins can open an envelope in Sign.
 */
export interface AgreementsOffer {
  id: string
  formId: string | null
}

export function AgreementsCard({
  source,
  recordLabel,
  className,
  offer,
  readOnly = false,
}: {
  source: SendSource
  recordLabel: string
  className?: string
  /** My profile: the person's own agreements, status only (nothing to send, no actions). */
  readOnly?: boolean
  /** The candidate's offer on this job (if any): "Send for signature" sends it; other agreements stay available. */
  offer?: AgreementsOffer | null
}) {
  const { isPlatformAdmin, isAdmin: isWorkspaceAdmin } = usePermissions()
  const isAdmin = !!(isPlatformAdmin || isWorkspaceAdmin)
  const { userId } = useAuth()
  const q = useRecordEnvelopes(SIGN_SENDING_LIVE ? source : null)
  const { actionsFor, dialogs } = useEnvelopeActions({ context: 'record' })
  const [open, setOpen] = useState(false)
  const [restore, setRestore] = useState<SendDraft | null>(null)
  // What the sheet sends: the offer, or another agreement for the record.
  const [mode, setMode] = useState<'offer' | 'other'>('other')
  const offerSource: SendSource | null =
    offer && source.type === 'candidate' ? { type: 'ats_offer', id: offer.id, candidateId: source.id, jobId: source.jobId, formId: offer.formId } : null
  const gate = useOfferGate(offerSource ? offer!.id : null)
  const canSendOffer = !!gate.data?.ok
  const sheetSource = mode === 'offer' && offerSource ? offerSource : source

  const openSheet = (m: 'offer' | 'other', draft: SendDraft | null = null) => {
    setMode(m)
    setRestore(draft)
    setOpen(true)
  }

  // Undo after sending reopens the sheet with what was entered.
  useEffect(() => {
    const onReopen = (ev: Event) => {
      const { sourceId, draft } = (ev as CustomEvent<{ sourceId: string; draft: SendDraft }>).detail
      if (sourceId === source.id) openSheet('other', draft)
      else if (offerSource && sourceId === offerSource.id) openSheet('offer', draft)
    }
    // The offer banner's "Send for signature" opens the same sheet.
    const onSendOffer = (ev: Event) => {
      const { offerId } = (ev as CustomEvent<{ offerId: string }>).detail
      if (offerSource && offerId === offerSource.id) openSheet('offer')
    }
    window.addEventListener('gio-sign-reopen', onReopen)
    window.addEventListener('gio-sign-send-offer', onSendOffer)
    return () => {
      window.removeEventListener('gio-sign-reopen', onReopen)
      window.removeEventListener('gio-sign-send-offer', onSendOffer)
    }
  }, [source.id, offerSource?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (q.data ?? []).filter((e) => e.status !== 'draft'), [q.data])

  if (!SIGN_SENDING_LIVE) return null

  return (
    <section className={cn('rounded-[14px] border bg-white', className)} style={{ borderColor: '#E7E8EE' }}>
      <header className="flex items-center gap-2 px-5 pb-2 pt-4">
        <h3 className="flex-1 font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 13, letterSpacing: '-0.02em' }}>
          Agreements
        </h3>
        {readOnly ? null : offerSource ? (
          <div className="flex items-center gap-1">
            <IconTip label={canSendOffer ? 'Send the offer for signature' : offerSendRefusal(gate.data?.reason)}>
              <Button variant="secondary" size="sm" icon={PenLine} onClick={() => openSheet('offer')} disabled={!canSendOffer} aria-label="Send the offer for signature">
                Send for signature
              </Button>
            </IconTip>
            <DropdownMenu>
              <IconTip label="More">
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" iconOnly aria-label="More ways to send">
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
              </IconTip>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem onClick={() => openSheet('other')}>
                  <FileSignature className="h-3.5 w-3.5" aria-hidden /> Other agreement…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button variant="secondary" size="sm" icon={PenLine} onClick={() => openSheet('other')}>
            Send for signature
          </Button>
        )}
      </header>
      <div className="px-5 pb-3">
        {q.isLoading ? (
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-9 rounded-md" />
          </div>
        ) : q.isError ? (
          <p className="py-2 font-inter text-[12px] text-virgilio-error">
            Couldn’t load agreements.{' '}
            <button type="button" className="underline" onClick={() => q.refetch()}>
              Retry
            </button>
          </p>
        ) : rows.length === 0 ? (
          <p className="py-2 font-inter text-[12px] leading-snug text-[#6B7080]">
            {readOnly
              ? 'Nothing yet. Agreements Virgilio sends you to sign show up here with their status.'
              : 'Nothing sent yet. Offers and agreements sent for signature show up here with their status.'}
          </p>
        ) : (
          <div className="divide-y divide-[#F1F0EC]">
            {rows.map((e) => {
              // The sender and admins can act on it; everyone else on the job sees the status.
              const actions = !readOnly && (isAdmin || e.sender_user_id === userId) ? actionsFor(e) : []
              const safe = actions.filter((x) => !x.danger)
              const danger = actions.filter((x) => x.danger)
              return (
                <div key={e.id} className="flex items-center gap-1">
                  {isAdmin && !readOnly ? (
                    <Link to={`/sign?envelope=${e.id}`} className="-mx-2 block min-w-0 flex-1 rounded-lg px-2 transition-colors duration-hover hover:bg-[#FAFAF7]">
                      <AgreementLine e={e} />
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <AgreementLine e={e} />
                    </div>
                  )}
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <IconTip label="Actions">
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="xs" iconOnly aria-label={`Actions for ${e.title}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                      </IconTip>
                      <DropdownMenuContent align="end" className="min-w-[190px]">
                        {safe.map((a) => (
                          <DropdownMenuItem key={a.id} onClick={() => void a.run()}>
                            <a.icon className="h-3.5 w-3.5" aria-hidden /> {a.label}
                          </DropdownMenuItem>
                        ))}
                        {danger.length > 0 && safe.length > 0 && <DropdownMenuSeparator />}
                        {danger.map((a) => (
                          <DropdownMenuItem key={a.id} onClick={() => void a.run()} className="text-destructive focus:text-destructive">
                            <a.icon className="h-3.5 w-3.5" aria-hidden /> {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <SendSheet open={open} onOpenChange={setOpen} source={sheetSource} recordLabel={recordLabel} isAdmin={isAdmin} restore={restore} />
      {dialogs}
    </section>
  )
}
