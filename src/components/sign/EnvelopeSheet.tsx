import { ArrowUpRight, Ban, CalendarClock, Check, CircleX, Clock, Eye, FileText, Hourglass, Mail, MoreHorizontal, ShieldCheck, X } from 'lucide-react'

import { FormSheet } from '@/components/references/FormSheet'
import { FormSection } from '@/components/references/FormSection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LoadError } from '@/components/empty/LoadError'
import { cn } from '@/lib/utils'
import { fillTags, useEnvelopeDetail, type EnvelopeRow, type SignRecipientStatus } from '@/lib/sign/api'
import { ENVELOPE_KIND, ENVELOPE_STATUS, ago, nextPending, shortDateTime } from '@/lib/sign/status'
import { useEnvelopeActions } from './envelopeActions'

const RECIPIENT_STATUS: Record<SignRecipientStatus, { label: string; icon: typeof Clock; tone?: 'ok' | 'bad' }> = {
  waiting: { label: 'Waiting', icon: Clock },
  sent: { label: 'Sent', icon: Mail },
  viewed: { label: 'Viewed', icon: Eye },
  signed: { label: 'Signed', icon: Check, tone: 'ok' },
  approved: { label: 'Approved', icon: Check, tone: 'ok' },
  declined: { label: 'Declined', icon: X, tone: 'bad' },
}
const ROLE_LABEL = { signer: 'Signer', approver: 'Approver', cc: 'Gets a copy' } as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts[0].includes('@')) return parts[0][0].toUpperCase()
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function Note({ tone, icon: Icon, children }: { tone: 'info' | 'lilac' | 'bad'; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'mb-[18px] flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 font-inter text-[12.5px] leading-[1.5]',
        tone === 'info' && 'bg-[#F4F3EF] text-text-secondary',
        tone === 'lilac' && 'bg-[#F3EDFE] text-[#4C1D95]',
        tone === 'bad' && 'bg-[#FBEAE8] text-[#8E2A20]',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function EnvelopeSheet({
  envelope,
  open,
  onOpenChange,
  myEmail,
}: {
  envelope: EnvelopeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  myEmail: string | null
}) {
  const detail = useEnvelopeDetail(open && envelope ? envelope.id : null)
  const actionsFor = useEnvelopeActions({ onRemoved: () => onOpenChange(false) })
  if (!envelope) return null

  const e = envelope
  const d = detail.data
  const actions = actionsFor(e)
  const footerActions = actions.filter((a) => a.footer)
  const status = ENVELOPE_STATUS[e.status]
  const next = nextPending(e)[0]
  const declined = d?.recipients.find((r) => r.status === 'declined')
  const mine = (myEmail ?? '').toLowerCase()

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      width={520}
      eyebrow={`${ENVELOPE_KIND[e.kind].label} envelope`}
      title={e.title}
      subtitle={
        <span className="mt-1 flex flex-wrap items-center gap-2.5">
          <Badge key={e.status} tone={status.tone} dot size="sm">
            {status.label}
          </Badge>
          {e.source_label && (
            <span className="inline-flex items-center gap-1 text-[12px] text-virgilio-purple">
              {e.source_label}
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </span>
          )}
          <span className="text-[12px] text-text-tertiary">Updated {ago(e.updated_at).toLowerCase()}</span>
        </span>
      }
      headerActions={
        actions.length > 0 ? (
          <DropdownMenu>
            <IconTip label="More actions">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" iconOnly aria-label="More actions"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
            </IconTip>
            <DropdownMenuContent align="end">
              {actions.map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => void a.run()} className={a.danger ? 'text-destructive focus:text-destructive' : undefined}>
                  <a.icon className="mr-2 h-4 w-4" aria-hidden />
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
      footer={
        footerActions.length > 0 ? (
          <>
            <span className="flex-1" />
            {footerActions.map((a) => (
              <Button key={a.id} variant={a.primary ? 'default' : 'secondary'} onClick={() => void a.run()}>
                <a.icon className="h-4 w-4" aria-hidden />
                {a.label}
              </Button>
            ))}
          </>
        ) : undefined
      }
    >
      {/* Where it stands */}
      {e.status === 'sent' && next && (
        <Note tone="info" icon={Hourglass}>
          {next.email === mine ? (
            <>
              <b className="font-semibold text-text-primary">Your turn to sign.</b> The people before you have signed.
            </>
          ) : (
            <>
              Waiting for <b className="font-semibold text-text-primary">{next.name ?? next.email}</b>.
            </>
          )}
          {d && d.reminder_days > 0 ? ` Reminder every ${d.reminder_days} day${d.reminder_days === 1 ? '' : 's'}.` : ''}
          {e.expires_at ? ` Expires ${shortDateTime(e.expires_at)}.` : ''}
        </Note>
      )}
      {e.status === 'scheduled' && e.scheduled_at && (
        <Note tone="lilac" icon={CalendarClock}>
          Sends on <b className="font-semibold">{shortDateTime(e.scheduled_at)}</b>. No one has been emailed yet.
        </Note>
      )}
      {e.status === 'declined' && (
        <Note tone="bad" icon={CircleX}>
          Declined by {declined?.name ?? 'a signer'}
          {declined?.decline_reason ? `: "${declined.decline_reason}"` : '.'}
        </Note>
      )}
      {e.status === 'voided' && (
        <Note tone="info" icon={Ban}>
          Voided{d?.void_reason ? `: "${d.void_reason}"` : '.'} Links no longer open.
        </Note>
      )}
      {e.status === 'expired' && (
        <Note tone="info" icon={Clock}>
          Expired before everyone signed. Links no longer open.
        </Note>
      )}

      {detail.isError ? (
        <div className="py-10">
          <LoadError what="this envelope" onRetry={() => detail.refetch()} compact />
        </div>
      ) : !d ? (
        <div className="space-y-4" aria-busy>
          {[96, 120, 80, 140].map((h, i) => (
            <Skeleton key={i} className="w-full rounded-xl" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <>
          {e.status === 'completed' && (
            <FormSection title="Evidence">
              <div className="flex flex-wrap gap-1.5">
                {['Consent recorded', 'Email code verified', 'Sealed (PAdES)', 'RFC 3161 timestamp'].map((x) => (
                  <span key={x} className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F3EF] px-2.5 py-1 font-inter text-[11.5px] text-text-primary">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    {x}
                  </span>
                ))}
              </div>
            </FormSection>
          )}

          <FormSection title={`Recipients${e.ordered ? ' · in order' : ''}`}>
            <ul className="-my-2">
              {d.recipients.map((r, i) => {
                const st = RECIPIENT_STATUS[r.status]
                const showStatus = r.role !== 'cc' && !['draft', 'scheduled'].includes(e.status)
                return (
                  <li key={r.id} className="flex items-center gap-2.5 border-b border-[#F6F5F1] py-2 last:border-b-0">
                    {e.ordered && (
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#F1F0EC] font-inter text-[10.5px] font-semibold text-text-secondary tabular-nums">
                        {i + 1}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-poppins text-[10.5px] font-semibold text-[#0d0d09]"
                      style={{ background: r.color }}
                    >
                      {initials(r.name ?? r.email ?? '')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-inter text-[12.5px] font-medium text-text-primary">{r.name ?? r.email}</div>
                      <div className="truncate font-inter text-[11.5px] text-text-tertiary">
                        {r.email} · {ROLE_LABEL[r.role]}
                      </div>
                    </div>
                    {showStatus && (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-inter text-[12px]',
                          st.tone === 'ok' ? 'text-[#1F8A5B]' : st.tone === 'bad' ? 'text-destructive' : 'text-text-secondary',
                        )}
                      >
                        <st.icon className="h-3.5 w-3.5" aria-hidden />
                        {st.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </FormSection>

          <FormSection title={`Documents · ${d.documents.length}`}>
            <ul className="-my-2">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2.5 border-b border-[#F6F5F1] py-2 last:border-b-0">
                  <span className="flex h-8 w-[26px] shrink-0 items-center justify-center rounded bg-[#F4F3EF] text-text-secondary">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-inter text-[12.5px] font-medium text-text-primary">{doc.name}</div>
                    <div className="font-inter text-[11.5px] text-text-tertiary tabular-nums">
                      {doc.page_count} page{doc.page_count === 1 ? '' : 's'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </FormSection>

          <FormSection title="Message">
            <div className="font-inter text-[13px] font-medium leading-[1.45] text-text-primary">{fillTags(d.subject || '(no subject)', d.data_snapshot)}</div>
            <div
              className="mt-1.5 max-h-16 overflow-hidden whitespace-pre-wrap font-inter text-[12px] leading-[1.5] text-text-secondary"
              style={{ WebkitMaskImage: 'linear-gradient(180deg,#000 60%,transparent)', maskImage: 'linear-gradient(180deg,#000 60%,transparent)' }}
            >
              {fillTags(d.body, d.data_snapshot)}
            </div>
          </FormSection>

          <FormSection title="Activity">
            {d.events.length === 0 ? (
              <p className="font-inter text-[12px] text-text-tertiary">Nothing has happened yet.</p>
            ) : (
              <ol className="flex flex-col">
                {d.events.map((ev, i) => (
                  <li key={ev.id} className="relative grid grid-cols-[14px_1fr] gap-2.5 pb-3 last:pb-0">
                    {i < d.events.length - 1 && <span aria-hidden className="absolute left-[6px] top-[14px] bottom-0 w-px bg-[#E7E8EE]" />}
                    <span aria-hidden className={cn('ml-[3px] mt-[5px] h-[7px] w-[7px] rounded-full', ev.key ? 'bg-[#0d0d09]' : 'bg-[#C9C8C1]')} />
                    <div className="min-w-0">
                      <div className="font-inter text-[12.5px] font-medium text-text-primary">{ev.label}</div>
                      <div className="font-inter text-[11.5px] text-text-tertiary tabular-nums">
                        {shortDateTime(ev.created_at)}
                        {ev.actor_name ? ` · ${ev.actor_name}` : ''}
                        {ev.ip ? ` · IP ${ev.ip}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </FormSection>
        </>
      )}
    </FormSheet>
  )
}
