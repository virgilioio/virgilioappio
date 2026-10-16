import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { ENVELOPE_STATUS, ago, shortDateTime, signersOf } from '@/lib/sign/status'
import { SIGN_SENDING_LIVE, useRecordEnvelopes, type SendSource } from '@/lib/sign/send'
import type { EnvelopeRow } from '@/lib/sign/api'
import { SendSheet, type SendDraft } from './SendSheet'

function Line({ e }: { e: EnvelopeRow }) {
  const st = ENVELOPE_STATUS[e.status]
  const signers = signersOf(e)
  const done = signers.filter((r) => r.status === 'signed').length
  const meta =
    e.status === 'scheduled' && e.scheduled_at
      ? `Sends ${shortDateTime(e.scheduled_at)}`
      : e.status === 'sent'
      ? `${done}/${signers.length} signed · ${ago(e.sent_at ?? e.updated_at)}`
      : e.status === 'completed' && e.completed_at
      ? `Signed ${ago(e.completed_at).replace(/^[A-Z]/, (c) => c.toLowerCase())}`
      : ago(e.updated_at)
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-[12.5px] font-medium text-[#1F2230]">{e.title}</p>
        <p className="mt-0.5 truncate font-inter text-[11.5px] tabular-nums text-[#6B7080]">{meta}</p>
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
export function AgreementsCard({
  source,
  recordLabel,
  className,
}: {
  source: SendSource
  recordLabel: string
  className?: string
}) {
  const { isPlatformAdmin, isAdmin: isWorkspaceAdmin } = usePermissions()
  const isAdmin = !!(isPlatformAdmin || isWorkspaceAdmin)
  const q = useRecordEnvelopes(SIGN_SENDING_LIVE ? source : null)
  const [open, setOpen] = useState(false)
  const [restore, setRestore] = useState<SendDraft | null>(null)

  // Undo after sending reopens the sheet with what was entered.
  useEffect(() => {
    const onReopen = (ev: Event) => {
      const { sourceId, draft } = (ev as CustomEvent<{ sourceId: string; draft: SendDraft }>).detail
      if (sourceId !== source.id) return
      setRestore(draft)
      setOpen(true)
    }
    window.addEventListener('gio-sign-reopen', onReopen)
    return () => window.removeEventListener('gio-sign-reopen', onReopen)
  }, [source.id])

  const rows = useMemo(() => (q.data ?? []).filter((e) => e.status !== 'draft'), [q.data])

  if (!SIGN_SENDING_LIVE) return null

  return (
    <section className={cn('rounded-[14px] border bg-white', className)} style={{ borderColor: '#E7E8EE' }}>
      <header className="flex items-center gap-2 px-5 pb-2 pt-4">
        <h3 className="flex-1 font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 13, letterSpacing: '-0.02em' }}>
          Agreements
        </h3>
        <Button
          variant="secondary"
          size="sm"
          icon={PenLine}
          onClick={() => {
            setRestore(null)
            setOpen(true)
          }}
        >
          Send for signature
        </Button>
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
            Nothing sent yet. Offers and agreements sent for signature show up here with their status.
          </p>
        ) : (
          <div className="divide-y divide-[#F1F0EC]">
            {rows.map((e) =>
              isAdmin ? (
                <Link
                  key={e.id}
                  to={`/sign?envelope=${e.id}`}
                  className="-mx-2 block rounded-lg px-2 transition-colors duration-hover hover:bg-[#FAFAF7]"
                >
                  <Line e={e} />
                </Link>
              ) : (
                <Line key={e.id} e={e} />
              ),
            )}
          </div>
        )}
      </div>
      <SendSheet open={open} onOpenChange={setOpen} source={source} recordLabel={recordLabel} isAdmin={isAdmin} restore={restore} />
    </section>
  )
}
