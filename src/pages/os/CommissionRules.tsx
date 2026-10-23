import { useMemo, useState } from 'react'
import { History as HistoryIcon, Percent, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { AffixInput } from '@/components/ui/affix-input'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { ProfileCard } from '@/components/os/ProfileParts'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { shakeFirstInvalid } from '@/lib/motion'
import { personName, usePeople } from '@/lib/os/peopleAccess'
import {
  COMMISSION_ROLES,
  commissionRoleLabel,
  rateFor,
  sendRatesNow,
  todayIso,
  useAddCommissionRate,
  useCommissionRates,
  type CommissionRate,
  type CommissionRoleKey,
} from '@/lib/os/commissions'

function day(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function AddRateDialog({ open, onOpenChange, tenantId }: { open: boolean; onOpenChange: (v: boolean) => void; tenantId: string }) {
  const add = useAddCommissionRate(tenantId)
  const [role, setRole] = useState<CommissionRoleKey | ''>('')
  const [pct, setPct] = useState('')
  const [from, setFrom] = useState<Date | undefined>(undefined)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const n = Number(pct)
  const problems = {
    role: !role ? 'Choose a role.' : undefined,
    pct: pct.trim() === '' ? 'Enter a rate.' : !Number.isFinite(n) || n < 0 || n > 100 ? 'Enter a rate from 0 to 100.' : undefined,
    from: !from ? 'Choose the date it applies from.' : undefined,
  }
  const reset = () => {
    setRole('')
    setPct('')
    setFrom(undefined)
    setNote('')
    setTried(false)
    setError(null)
  }

  const submit = async () => {
    setTried(true)
    setError(null)
    if (problems.role || problems.pct || problems.from) {
      shakeFirstInvalid()
      return
    }
    try {
      await add.mutateAsync({ role_key: role as CommissionRoleKey, pct: Math.round(n * 100) / 100, effective_from: toIso(from!), note: note.trim() || null })
      toast(`${commissionRoleLabel(role)}: ${pctText(n)} from ${day(toIso(from!))}. Sending to Gio Sales.`)
      reset()
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (add.isPending) return
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add a commission rate</DialogTitle>
          <DialogDescription>
            The new rate applies from its date on. Earlier invoices keep the rate they were issued with.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <FormField label="Role" htmlFor="rate-role" error={tried ? problems.role : undefined}>
            <Select value={role} onValueChange={(v) => setRole(v as CommissionRoleKey)} disabled={add.isPending}>
              <SelectTrigger id="rate-role" aria-invalid={tried && !!problems.role}>
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {COMMISSION_ROLES.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Rate" htmlFor="rate-pct" error={tried ? problems.pct : undefined}>
              <AffixInput
                id="rate-pct"
                numeric
                inputMode="decimal"
                suffix="%"
                value={pct}
                invalid={tried && !!problems.pct}
                aria-invalid={tried && !!problems.pct}
                disabled={add.isPending}
                onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))}
              />
            </FormField>
            <FormField label="Applies from" htmlFor="rate-from" error={tried ? problems.from : undefined}>
              <div aria-invalid={tried && !!problems.from}>
                <DatePickerVirgilio value={from} onChange={setFrom} placeholder="Pick a date" className="w-full" />
              </div>
            </FormField>
          </div>
          <FormField label="Note" htmlFor="rate-note" helpText="Optional, for example the agreement it comes from">
            <Input id="rate-note" value={note} maxLength={300} disabled={add.isPending} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={error ? 'alert' : undefined}>
            {error ?? ''}
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={add.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending}>
              Add rate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

      {tenant?.id && <AddRateDialog open={adding} onOpenChange={setAdding} tenantId={tenant.id} />}
    </ListPage>
  )
}
