import { useMemo, useState } from 'react'
import { History as HistoryIcon, Percent, Plus, RefreshCw } from 'lucide-react'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { ProfileCard } from '@/components/os/ProfileParts'
import { AddCommissionRateDialog } from '@/components/os/AddCommissionRateDialog'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { personName, usePeople } from '@/lib/os/peopleAccess'
import {
  COMMISSION_ROLES,
  commissionRoleLabel,
  rateFor,
  sendRatesNow,
  useCommissionRates,
  type CommissionRate,
} from '@/lib/os/commissions'

function day(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}%`

/** Where a rate got to in Gio Sales. */
function Delivery({ rate }: { rate: CommissionRate }) {
  if (rate.sync_status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#0B7A52]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#12B886]" aria-hidden />
        In Gio Sales
      </span>
    )
  }
  if (rate.sync_status === 'refused') {
    return (
      <span className="block text-[#B91C1C]">
        Gio Sales refused it
        {rate.sync_error && <span className="block text-[11.5px] text-[#6B7080]">{rate.sync_error}</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#B45309]">
      <span className="gio-spinner h-3 w-3" aria-hidden />
      Sending to Gio Sales
      {rate.sync_error && <span className="sr-only">: {rate.sync_error}</span>}
    </span>
  )
}

/**
 * /os/commissions — Commission rules (Allan, 2026-10-23): the rate each role
 * earns on a placement, managed here and delivered to Gio Sales, whose
 * invoices use them. Rates are never edited, only added with a later date.
 */
export default function CommissionRulesPage() {
  const { tenant } = useTenant()
  const rates = useCommissionRates(tenant?.id)
  const people = usePeople(tenant?.id)
  const [adding, setAdding] = useState(false)
  const [sending, setSending] = useState(false)
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(rates.isLoading, retry)
  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'From Gio Sales')
  }, [people.data])

  const rows = rates.data ?? []
  const waiting = rows.filter((r) => r.sync_status === 'pending').length
  const failed = rates.isError || timedOut

  const sendNow = async () => {
    if (!tenant?.id) return
    setSending(true)
    try {
      await sendRatesNow(tenant.id)
    } finally {
      setSending(false)
      void rates.refetch()
    }
  }

  return (
    <ListPage
      title="Commission rules"
      meta={
        <span>
          Each role&apos;s share of the net revenue Virgilio collects on a placement (salary × success fee). Gio Sales uses these
          when it issues an invoice.
        </span>
      }
      actions={
        <Button icon={Plus} onClick={() => setAdding(true)} disabled={!tenant?.id}>
          Add rate
        </Button>
      }
    >
      {failed ? (
        <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
          <LoadError
            what="the commission rules"
            timedOut={timedOut && !rates.isError}
            onRetry={() => {
              setRetry((n) => n + 1)
              void rates.refetch()
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ProfileCard title="In force today" icon={Percent}>
            {rates.isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {COMMISSION_ROLES.map((r) => (
                  <Skeleton key={r.key} className="h-[92px] w-full rounded-[10px]" />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {COMMISSION_ROLES.map((r) => {
                  const { current, next } = rateFor(rows, r.key)
                  return (
                    <div key={r.key} className="rounded-[10px] bg-[#F7F6F2] px-3 py-2.5">
                      <div className="truncate font-inter text-[12px] font-medium text-[#1F2230]">{r.label}</div>
                      <div className="font-poppins text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-[#1F2230]">
                        {current ? pctText(current.pct) : '—'}
                      </div>
                      <div className="truncate font-inter text-[11.5px] text-[#6B7080]">
                        {current ? `Since ${day(current.effective_from)}` : 'No rate yet'}
                      </div>
                      {next && (
                        <div className="truncate font-inter text-[11.5px] font-medium text-[#6F3FF5]">
                          {pctText(next.pct)} from {day(next.effective_from)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p className="pt-3 font-inter text-[11.5px] leading-[1.5] text-[#6B7080]">
              TA Partner and Sourcing Partner are credited from the hire in Gio ATS; Sales and Engagement Specialist from the
              deal in Gio Sales. People who share a role split its rate equally.
            </p>
          </ProfileCard>

          <ProfileCard
            title="All rates"
            icon={HistoryIcon}
            flush
            aside={
              waiting > 0 ? (
                <Button variant="ghost" size="sm" icon={RefreshCw} loading={sending} onClick={() => void sendNow()}>
                  Send now
                </Button>
              ) : undefined
            }
          >
            <Table density="comfortable">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Applies from</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[80px] text-right">Rate</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="hidden md:table-cell w-[170px]">Added by</TableHead>
                  <TableHead className="w-[200px]">Gio Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.isLoading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{day(r.effective_from)}</TableCell>
                        <TableCell className="font-medium text-[#1F2230]">{commissionRoleLabel(r.role_key)}</TableCell>
                        <TableCell className="text-right">{pctText(r.pct)}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[260px] truncate text-[#5A6072]">{r.note ?? ''}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[170px] truncate text-[#5A6072]">{nameOf(r.created_by)}</TableCell>
                        <TableCell className="text-[12.5px]">
                          <Delivery rate={r} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </ProfileCard>
        </div>
      )}

      {tenant?.id && <AddCommissionRateDialog open={adding} onOpenChange={setAdding} tenantId={tenant.id} rates={rows} />}
    </ListPage>
  )
}
