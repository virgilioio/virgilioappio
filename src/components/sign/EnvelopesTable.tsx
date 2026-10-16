import { useMemo, useState } from 'react'
import { ArrowRight, Building2, CalendarClock, IdCard, PenLine, RotateCcw, Search, ShieldCheck, UserRound, X } from 'lucide-react'

import { ListTabs } from '@/components/ui/list-tabs'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AvatarStack, IdentityCell, StatusCell } from '@/components/ui/table-cells'
import { TableSkeleton } from '@/components/ui/table-states'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { cn } from '@/lib/utils'
import type { EnvelopeRow, SignKind } from '@/lib/sign/api'
import {
  ENVELOPE_FILTERS,
  ENVELOPE_KIND,
  ENVELOPE_STATUS,
  ago,
  isWaitingOnMe,
  matchesFilter,
  shortDateTime,
  signersOf,
  type EnvelopeFilter,
} from '@/lib/sign/status'

const KIND_ICON: Record<SignKind, typeof Building2> = { customer: Building2, candidate: UserRound, member: IdCard }
const COLS = 7

const TAB_EMPTY: Record<EnvelopeFilter, { title: string; body: string }> = {
  all: { title: 'No envelopes', body: 'Envelopes sent from a candidate, a deal or here show up in this list.' },
  draft: { title: 'No drafts', body: 'Envelopes saved before sending show up here.' },
  scheduled: { title: 'Nothing scheduled', body: 'Envelopes set to go out later show up here until they send.' },
  sent: { title: 'Nothing out for signature', body: 'Sent envelopes wait here until everyone has signed.' },
  completed: { title: 'Nothing completed yet', body: 'Envelopes everyone has signed show up here, sealed.' },
  closed: { title: 'Nothing closed', body: 'Voided, declined and expired envelopes show up here.' },
}

export function EnvelopesTable({
  envelopes,
  isLoading,
  loadError,
  onRetry,
  filter,
  onFilterChange,
  myEmail,
  myId,
}: {
  envelopes: EnvelopeRow[]
  isLoading: boolean
  loadError: 'failed' | 'timeout' | null
  onRetry: () => void
  filter: EnvelopeFilter
  onFilterChange: (f: EnvelopeFilter) => void
  myEmail: string | null
  myId: string | null
}) {
  const [q, setQ] = useState('')
  const [kinds, setKinds] = useState<string[]>([])
  const [mine, setMine] = useState(false)
  const filtered = !!q.trim() || kinds.length > 0 || mine
  const clearAll = () => {
    setQ('')
    setKinds([])
    setMine(false)
  }

  const waiting = useMemo(() => envelopes.filter((e) => isWaitingOnMe(e, myEmail, myId)), [envelopes, myEmail, myId])

  // Search, type and "Waiting on me" narrow the list; the status tabs count what's left.
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return envelopes.filter((e) => {
      if (kinds.length && !kinds.includes(e.kind)) return false
      if (mine && !isWaitingOnMe(e, myEmail, myId)) return false
      if (!needle) return true
      const hay = [e.title, e.source_label ?? '', ...e.recipients.flatMap((r) => [r.name ?? '', r.email ?? ''])].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [envelopes, q, kinds, mine, myEmail, myId])

  const rows = useMemo(() => base.filter((e) => matchesFilter(filter, e.status)), [base, filter])

  const kindOptions = (Object.keys(ENVELOPE_KIND) as SignKind[]).map((k) => ({
    value: k,
    label: ENVELOPE_KIND[k].label,
    count: envelopes.filter((e) => e.kind === k).length,
  }))

  const renderEmpty = () =>
    envelopes.length === 0 ? (
      <AnimatedEmpty
        scene="jobs"
        onceKey="sign-envelopes"
        title="No envelopes yet"
        body="Offers sent from a candidate, agreements sent from a deal in Gio Sales, and member agreements sent from here will show up in this list with their status."
      />
    ) : filtered ? (
      <AnimatedEmpty
        scene="search"
        onceKey="sign-envelopes"
        title="No envelopes match these filters"
        body={`${envelopes.length} envelope${envelopes.length === 1 ? ' is' : 's are'} hidden by the search or filters.`}
        primary={{ label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: clearAll }}
      />
    ) : (
      <AnimatedEmpty scene="jobs" onceKey="sign-envelopes" title={TAB_EMPTY[filter].title} body={TAB_EMPTY[filter].body} />
    )

  return (
    <div className="space-y-4">
      {/* Tabs + filters card */}
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        <ListTabs
          label="Envelope status"
          value={filter}
          onChange={onFilterChange}
          tabs={ENVELOPE_FILTERS.map((t) => ({
            value: t.value,
            label: t.label,
            count: isLoading ? undefined : base.filter((e) => matchesFilter(t.value, e.status)).length,
          }))}
        />
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by envelope, recipient or record…"
              aria-label="Search envelopes"
              className="h-10 pl-10 pr-9 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="gio-search-clear absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChipPopover label="Type" options={kindOptions} selectedValues={kinds} onSelectionChange={setKinds} />
            <button
              type="button"
              aria-pressed={mine}
              onClick={() => setMine((v) => !v)}
              className={cn(
                'gio-pressable inline-flex items-center gap-1.5 font-poppins font-medium transition-colors duration-150 whitespace-nowrap',
                'h-9 px-3.5 rounded-lg border border-virgilio-border text-[13px] text-text-primary',
                mine ? 'bg-[#FAFAF7] hover:bg-[hsl(var(--menu-hover))]' : 'bg-white hover:bg-[#FAFAF7]',
              )}
            >
              {mine ? (
                <>
                  <PenLine className="h-3.5 w-3.5 text-virgilio-purple" aria-hidden />
                  <span>Waiting on me</span>
                  <span className="text-[hsl(var(--menu-group-color))]">·</span>
                  <span className="text-virgilio-purple tabular-nums">{waiting.length}</span>
                </>
              ) : (
                <>
                  <span aria-hidden className="text-[15px] leading-none text-[hsl(var(--menu-group-color))] -mt-px">+</span>
                  Waiting on me
                </>
              )}
            </button>
            {filtered && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Countersign banner */}
      {waiting.length > 0 && !mine && filter !== 'completed' && (
        <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EE] bg-white px-3.5 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1F0EC]">
            <PenLine className="h-3.5 w-3.5 text-text-primary" aria-hidden />
          </span>
          <p className="flex-1 min-w-0 font-inter text-[12.5px] text-text-secondary">
            <span className="font-medium text-text-primary">
              {waiting.length} envelope{waiting.length === 1 ? ' is' : 's are'} waiting for your signature
            </span>{' '}
            · the people before you have signed
          </p>
          <Button variant="secondary" size="sm" onClick={() => setMine(true)}>
            Review <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Status</TableHead>
              <TableHead>Envelope</TableHead>
              <TableHead className="hidden xl:table-cell w-[120px]">Type</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead className="w-[150px]">Signed</TableHead>
              <TableHead className="hidden xl:table-cell">Related record</TableHead>
              <TableHead className="w-[100px] text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !loadError ? (
              <TableSkeleton rows={5} columns={COLS} />
            ) : loadError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '56px 24px' }}>
                  <LoadError what="envelopes" timedOut={loadError === 'timeout'} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                  {renderEmpty()}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => <EnvelopeTableRow key={e.id} e={e} waitingOnMe={isWaitingOnMe(e, myEmail, myId)} />)
            )}
          </TableBody>
        </Table>
        {!isLoading && !loadError && rows.length > 0 && (
          <div className="flex items-center gap-1.5 border-t border-[#F1F0EC] bg-[#FAFAF7] px-3.5 py-2.5 font-inter text-[11.5px] text-text-tertiary">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Every signature carries consent, an email code, a sealed PDF and a trusted timestamp. Signed copies attach to the related record.
          </div>
        )}
      </div>
    </div>
  )
}

function EnvelopeTableRow({ e, waitingOnMe }: { e: EnvelopeRow; waitingOnMe: boolean }) {
  const status = ENVELOPE_STATUS[e.status]
  const KindIcon = KIND_ICON[e.kind]
  const pages = e.documents.reduce((n, d) => n + d.page_count, 0)
  const docs = e.documents.length
  const first = e.recipients[0]
  return (
    <TableRow data-row-id={e.id}>
      <TableCell>
        <StatusCell>
          <Badge key={e.status} tone={status.tone} dot size="sm">
            {status.label}
          </Badge>
        </StatusCell>
      </TableCell>
      <TableCell>
        <IdentityCell
          hideAvatar
          name={<span className="block truncate max-w-[min(340px,24vw)]">{e.title}</span>}
          sub={`${docs} document${docs === 1 ? '' : 's'} · ${pages} page${pages === 1 ? '' : 's'}${waitingOnMe ? ' · your turn to sign' : ''}`}
          fallback={e.title}
        />
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-secondary">
          <KindIcon className="h-3.5 w-3.5" aria-hidden />
          {ENVELOPE_KIND[e.kind].label}
        </span>
      </TableCell>
      <TableCell>
        {first ? (
          <span className="flex items-center gap-2 whitespace-nowrap min-w-0">
            <AvatarStack
              people={e.recipients.map((r) => ({ name: r.name ?? r.email ?? '', fallback: r.name ?? r.email ?? '?', color: r.color }))}
              max={3}
              size={24}
            />
            <span className="truncate text-text-secondary">
              {(first.name ?? first.email ?? '').split(' ')[0]}
              {e.recipients.length > 1 ? ` +${e.recipients.length - 1}` : ''}
            </span>
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </TableCell>
      <TableCell>
        <SignedProgress e={e} />
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <span className="block truncate max-w-[220px] text-text-secondary">{e.source_label ?? '—'}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="tabular-nums text-text-tertiary">{ago(e.updated_at)}</span>
      </TableCell>
    </TableRow>
  )
}

function SignedProgress({ e }: { e: EnvelopeRow }) {
  if (e.status === 'draft') return <span className="text-text-tertiary">Not sent</span>
  if (e.status === 'scheduled' && e.scheduled_at)
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-secondary tabular-nums">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        {shortDateTime(e.scheduled_at)}
      </span>
    )
  const signers = signersOf(e)
  const done = signers.filter((r) => r.status === 'signed').length
  return (
    <div className="flex items-center gap-2" aria-label={`${done} of ${signers.length} signed`}>
      <span className="flex flex-1 gap-[3px] max-w-[96px]">
        {signers.map((r) => (
          <i
            key={r.id}
            className={cn(
              'block h-1.5 flex-1 rounded-full transition-colors duration-300',
              r.status === 'signed' ? (e.status === 'completed' ? 'bg-[#1F8A5B]' : 'bg-[#1F2230]') : 'bg-[#E7E5DE]',
            )}
          />
        ))}
      </span>
      <span className="font-inter text-[11.5px] font-semibold text-text-secondary tabular-nums">
        {done}/{signers.length}
      </span>
    </div>
  )
}
