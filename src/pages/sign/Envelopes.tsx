import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { EnvelopesTable } from '@/components/sign/EnvelopesTable'
import { EnvelopeSheet } from '@/components/sign/EnvelopeSheet'
import { useEnvelopeActions } from '@/components/sign/envelopeActions'
import { useAuth } from '@/contexts/AuthContext'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useEnvelopes } from '@/lib/sign/api'
import { ENVELOPE_FILTERS, type EnvelopeFilter } from '@/lib/sign/status'

/** Sign › Envelopes (admins only): every envelope, filtered by status tab, type and "Waiting on me". */
export default function SignEnvelopes() {
  const { user } = useAuth()
  const q = useEnvelopes()
  const timedOut = useLoadTimeout(q.isLoading, q.dataUpdatedAt)
  const [params, setParams] = useSearchParams()
  const raw = params.get('status') as EnvelopeFilter | null
  const filter: EnvelopeFilter = raw && ENVELOPE_FILTERS.some((f) => f.value === raw) ? raw : 'all'
  const setFilter = (f: EnvelopeFilter) =>
    setParams(
      (p) => {
        if (f === 'all') p.delete('status')
        else p.set('status', f)
        return p
      },
      { replace: true },
    )

  const envelopes = q.data ?? []
  const selectedId = params.get('envelope')
  const selected = envelopes.find((e) => e.id === selectedId) ?? null
  // Keep the last envelope on screen while the sheet slides out.
  const lastShown = useRef(selected)
  if (selected) lastShown.current = selected
  const setSelected = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('envelope', id)
        else p.delete('envelope')
        return p
      },
      { replace: true },
    )
  const actionsFor = useEnvelopeActions()
  const count = (s: string) => envelopes.filter((e) => e.status === s).length
  const out = count('sent') + count('queued')

  return (
    <ListPage
      title="Envelopes"
      count={q.data ? envelopes.length : undefined}
      meta={
        q.data && (
          <>
            <button type="button" onClick={() => setFilter('sent')} className="hover:text-text-primary transition-colors duration-hover">
              <MetaDot color="#E0891A">{out} out for signature</MetaDot>
            </button>
            <button type="button" onClick={() => setFilter('scheduled')} className="hover:text-text-primary transition-colors duration-hover">
              <MetaDot color="#8B5CF6">{count('scheduled')} scheduled</MetaDot>
            </button>
            <button type="button" onClick={() => setFilter('completed')} className="hover:text-text-primary transition-colors duration-hover">
              <MetaDot color="#12B886">{count('completed')} completed</MetaDot>
            </button>
            <button type="button" onClick={() => setFilter('draft')} className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors duration-hover">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-dashed border-[#8B8F9E]" />
              {count('draft')} draft{count('draft') === 1 ? '' : 's'}
            </button>
          </>
        )
      }
    >
      <EnvelopesTable
        envelopes={envelopes}
        isLoading={q.isLoading}
        loadError={q.isError ? 'failed' : timedOut ? 'timeout' : null}
        onRetry={() => q.refetch()}
        filter={filter}
        onFilterChange={setFilter}
        myEmail={user?.email ?? null}
        myId={user?.id ?? null}
        selectedId={selectedId}
        onOpen={setSelected}
        actionsFor={actionsFor}
      />
      <EnvelopeSheet
        envelope={selected ?? lastShown.current}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        myEmail={user?.email ?? null}
      />
    </ListPage>
  )
}
