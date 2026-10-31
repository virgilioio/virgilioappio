import { useState, type ReactNode } from 'react'
import { Download, Eye, FileText, History, Receipt, SlidersHorizontal, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { FilterChipSelect } from '@/components/ui/filter-chip-select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { CandidateFileViewer, type ViewerFile } from '@/components/candidates/profile/CandidateFileViewer'
import { ProfileCard } from '@/components/os/ProfileParts'
import { byCurrency, money } from '@/lib/os/earnings'
import {
  ADJUSTMENT_LABEL,
  downloadInvoice,
  invoiceLink,
  monthName,
  type InvoiceFile,
  type PersonAdjustment,
  type PersonPayout,
  usePersonAdjustments,
  usePersonPayouts,
} from '@/lib/os/payouts'
import { Dot, Money, PAYOUT_STATUS, PERIOD_LABEL, PERIODS, day, payoutWhen, periodFrom, rowButtonProps, type PeriodFilter } from './parts'

/**
 * The payout side of Earnings (commissions phase 3, 2026-10-31): Payouts, the
 * payout sheet, Invoices and Adjustments. Read only; Billing works on these in
 * Gio Sales. Drafts never reach Gio ATS, and removed or dismissed adjustments
 * never show.
 */

type Payouts = ReturnType<typeof usePersonPayouts>
type Adjustments = ReturnType<typeof usePersonAdjustments>

const ADJUSTMENT_DOT: Record<PersonAdjustment['kind'], string> = {
  bonus: '#12B886',
  correction: '#0EA5E9',
  clawback: '#E8590C',
  other: '#9CA3AF',
  carry_over: '#8456F6',
}

/** Where a payout's date sits: paid, else approved, else its month. */
const payoutDate = (p: PersonPayout) => p.paid_on ?? p.approved_on ?? p.month

function Rows({ n, h = 40 }: { n: number; h?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="w-full" style={{ height: h }} />
      ))}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="p-4 font-inter text-[12.5px] leading-[1.5] text-[#6B7080]">{children}</p>
}

// ---------- Invoices: view and download ----------

type Viewing = { payoutId: string; which: InvoiceFile; file: ViewerFile & { url: string } }

/** Opening an invoice asks Gio Sales for a 5-minute link first, so the viewer knows its name and kind. */
export function useInvoiceActions(self: boolean) {
  const [viewing, setViewing] = useState<Viewing | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, work: () => Promise<void>, failed: string) => {
    if (busy) return
    setBusy(key)
    try {
      await work()
    } catch {
      toast.error(failed)
    } finally {
      setBusy(null)
    }
  }
  const view = (p: PersonPayout, which: InvoiceFile) =>
    run(
      `view:${p.id}:${which}`,
      async () => {
        const { url, filename } = await invoiceLink(p.id, which)
        setViewing({
          payoutId: p.id,
          which,
          file: {
            id: `${p.id}:${which}`,
            file_name: filename,
            file_type: /\.pdf$/i.test(filename) ? 'application/pdf' : null,
            file_size_bytes: null,
            created_at: p.invoice_issued_on ?? p.approved_on ?? p.month,
            file_url: '',
            url,
          },
        })
      },
      "Couldn't open the invoice. Try again.",
    )
  const download = (p: PersonPayout, which: InvoiceFile) =>
    run(`download:${p.id}:${which}`, () => downloadInvoice(p.id, which), "Couldn't download the invoice. Try again.")
  return { viewing, setViewing, view, download, busy, self }
}
export type InvoiceActions = ReturnType<typeof useInvoiceActions>

/** The candidate file viewer on the invoice's own link; a retry asks for a fresh one. */
export function InvoiceViewer({ actions }: { actions: InvoiceActions }) {
  const v = actions.viewing
  const [used, setUsed] = useState<string | null>(null)
  return (
    <CandidateFileViewer
      files={v ? [v.file] : []}
      index={v ? 0 : null}
      onIndex={() => {}}
      onClose={() => actions.setViewing(null)}
      addedLabel="Issued"
      onDownload={() => {
        if (!v) return
        void downloadInvoice(v.payoutId, v.which).catch(() => toast.error("Couldn't download the invoice. Try again."))
      }}
      signedUrl={async (f) => {
        // The first look uses the link that opened it; a retry gets a new one.
        if (v && used !== f.id) {
          setUsed(f.id)
          return v.file.url
        }
        return v ? (await invoiceLink(v.payoutId, v.which)).url : null
      }}
    />
  )
}

function InvoiceButtons({ p, actions, compact }: { p: PersonPayout; actions: InvoiceActions; compact?: boolean }) {
  const files: { which: InvoiceFile; label: string; show: boolean }[] = [
    { which: 'invoice', label: compact ? 'View' : 'View invoice', show: p.has_invoice_pdf },
    { which: 'own', label: compact ? (actions.self ? 'Yours' : 'Theirs') : actions.self ? 'Your own invoice' : 'Their own invoice', show: p.has_own_invoice },
  ]
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {files
        .filter((f) => f.show)
        .map((f) => (
          <span key={f.which} className="inline-flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              icon={Eye}
              loading={actions.busy === `view:${p.id}:${f.which}`}
              onClick={(e) => {
                e.stopPropagation()
                void actions.view(p, f.which)
              }}
            >
              {f.label}
            </Button>
            <IconTip label={f.which === 'own' ? (actions.self ? 'Download your own invoice' : 'Download their own invoice') : 'Download invoice'}>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={Download}
                aria-label={f.which === 'own' ? (actions.self ? 'Download your own invoice' : 'Download their own invoice') : 'Download invoice'}
                loading={actions.busy === `download:${p.id}:${f.which}`}
                onClick={(e) => {
                  e.stopPropagation()
                  void actions.download(p, f.which)
                }}
              />
            </IconTip>
          </span>
        ))}
    </div>
  )
}

// ---------- Payouts ----------

export function PayoutsView({ payouts, self, onOpen }: { payouts: Payouts; self: boolean; onOpen: (id: string) => void }) {
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [currency, setCurrency] = useState('all')
  const all = payouts.data ?? []
  const currencies = [...new Set(all.map((p) => p.currency))].sort()
  const from = periodFrom(period)
  const shown = all
    .filter((p) => (currency === 'all' || p.currency === currency) && (!from || payoutDate(p) >= from))
    .sort((a, b) => (a.status === b.status ? payoutDate(b).localeCompare(payoutDate(a)) : a.status === 'approved' ? -1 : 1))
  const total = byCurrency(shown.map((p) => ({ amount: p.total, currency: p.currency })))
  return (
    <ProfileCard title="Payouts" icon={Wallet} tone="green" flush>
      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EFEEEA] px-4 py-3">
          <FilterChipSelect
            label="Period"
            value={period}
            alwaysActive={false}
            onChange={(v) => setPeriod(v as PeriodFilter)}
            options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
          />
          {currencies.length > 1 && (
            <FilterChipSelect
              label="Currency"
              value={currency}
              alwaysActive={false}
              onChange={setCurrency}
              options={[{ value: 'all', label: 'Any' }, ...currencies.map((c) => ({ value: c, label: c }))]}
            />
          )}
        </div>
      )}
      {payouts.isLoading ? (
        <Rows n={3} />
      ) : payouts.isError ? (
        <div className="p-4">
          <LoadError what={self ? 'your payouts' : 'their payouts'} compact onRetry={() => void payouts.refetch()} />
        </div>
      ) : all.length === 0 ? (
        <Empty>
          No payouts yet. Each one shows up here once Billing approves it, with its lines and invoice, and again when Virgilio pays it.
        </Empty>
      ) : shown.length === 0 ? (
        <Empty>
          None of the {all.length} {all.length === 1 ? 'payout is' : 'payouts are'} in {PERIOD_LABEL[period].toLowerCase()}
          {currency !== 'all' ? ` in ${currency}` : ''}.{' '}
          <button
            type="button"
            onClick={() => {
              setPeriod('all')
              setCurrency('all')
            }}
            className="font-medium text-[#6F3FF5] underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        </Empty>
      ) : (
        <div className="max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>For</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.id} {...rowButtonProps(() => onOpen(p.id), `${monthName(p.month)} payout`)}>
                  <TableCell className="max-w-[220px] sm:max-w-[280px]">
                    <span className="block whitespace-nowrap font-medium text-[#1F2230]">{monthName(p.month)}</span>
                    <span className="block truncate text-[11.5px] text-[#6B7080]">
                      {p.historical
                        ? (p.note ?? 'Paid before Commissions')
                        : `${p.lines || p.items.length} ${(p.lines || p.items.length) === 1 ? 'line' : 'lines'}`}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-[#5A6072] sm:hidden">
                      <Dot {...PAYOUT_STATUS[p.status]} /> · {payoutWhen(p)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Dot {...PAYOUT_STATUS[p.status]} />
                    <span className="block text-[11.5px] text-[#6B7080]">{payoutWhen(p)}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[#5A6072]">{p.invoice_number ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">
                    <Money amount={p.total} currency={p.currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t border-[#EFEEEA] px-4 py-3 font-inter text-[12.5px]">
            <span className="text-[#6B7080]">
              {shown.length} {shown.length === 1 ? 'payout' : 'payouts'}
              {period !== 'all' ? ` · ${PERIOD_LABEL[period].toLowerCase()}` : ''}
            </span>
            <span className="font-semibold tabular-nums text-[#1F2230]">{total.map((t) => money(t.amount, t.currency).text).join(' · ')}</span>
          </div>
        </div>
      )}
    </ProfileCard>
  )
}

/** The last few payments, for the Overview, with a way to the whole list. */
export function RecentPayments({ payouts, self, onOpen, onAll }: { payouts: Payouts; self: boolean; onOpen: (id: string) => void; onAll: () => void }) {
  const paid = (payouts.data ?? []).filter((p) => p.status === 'paid').sort((a, b) => payoutDate(b).localeCompare(payoutDate(a)))
  const shown = paid.slice(0, 3)
  return (
    <ProfileCard
      title="Last payments"
      icon={History}
      tone="green"
      flush
      aside={
        paid.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onAll}>
            See all payouts
          </Button>
        ) : undefined
      }
    >
      {payouts.isLoading ? (
        <Rows n={2} />
      ) : payouts.isError ? (
        <div className="p-4">
          <LoadError what={self ? 'your payments' : 'their payments'} compact onRetry={() => void payouts.refetch()} />
        </div>
      ) : shown.length === 0 ? (
        <Empty>No commissions paid yet. Each payment shows up here once Virgilio marks it paid.</Empty>
      ) : (
        <ul className="divide-y divide-[#EFEEEA] border-t border-[#EFEEEA]">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="flex min-h-[56px] w-full items-center gap-3 px-5 py-2.5 text-left transition-colors duration-hover hover:bg-[#FAFAF7]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">{monthName(p.month)}</span>
                  <span className="block truncate font-inter text-[11.5px] text-[#6B7080]">
                    {[payoutWhen(p), p.invoice_number].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 font-inter text-[13px] font-medium text-[#1F2230]">
                  <Money amount={p.total} currency={p.currency} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  )
}

/** The payouts Billing approved and hasn't paid: when they're due and what's on the invoice. */
export function NextPayoutCard({
  payouts,
  self,
  onOpen,
  actions,
}: {
  payouts: Payouts
  self: boolean
  onOpen: (id: string) => void
  actions: InvoiceActions
}) {
  const next = (payouts.data ?? []).filter((p) => p.status === 'approved').sort((a, b) => a.month.localeCompare(b.month))
  return (
    <ProfileCard title={next.length > 1 ? 'Next payouts' : 'Next payout'} icon={Wallet} tone="blue" flush>
      {payouts.isLoading ? (
        <Rows n={1} h={56} />
      ) : payouts.isError ? (
        <div className="p-4">
          <LoadError what={self ? 'your next payout' : 'their next payout'} compact onRetry={() => void payouts.refetch()} />
        </div>
      ) : next.length === 0 ? (
        <Empty>
          {self ? 'Nothing approved for you right now.' : 'Nothing approved for them right now.'} Billing prepares payouts each month from
          what's payable; once one is approved it shows here with its due date and invoice.
        </Empty>
      ) : (
        <ul className="divide-y divide-[#EFEEEA] border-t border-[#EFEEEA]">
          {next.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <button type="button" onClick={() => onOpen(p.id)} className="min-w-[180px] flex-1 text-left">
                <span className="block font-inter text-[13px] font-medium text-[#1F2230]">{monthName(p.month)}</span>
                <span className="block font-inter text-[11.5px] text-[#6B7080]">
                  {[payoutWhen(p), p.invoice_number].filter(Boolean).join(' · ')}
                </span>
              </button>
              <span className="font-poppins text-[18px] font-semibold tracking-[-0.02em] text-[#1F2230]">
                <Money amount={p.total} currency={p.currency} />
              </span>
              {(p.has_invoice_pdf || p.has_own_invoice) && <InvoiceButtons p={p} actions={actions} compact />}
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  )
}

// ---------- The payout sheet ----------

export function PayoutSheet({
  payoutId,
  payouts,
  adjustments,
  self,
  onClose,
  actions,
}: {
  payoutId: string | null
  payouts: Payouts
  adjustments: Adjustments
  self: boolean
  onClose: () => void
  actions: InvoiceActions
}) {
  const p = payoutId ? (payouts.data ?? []).find((x) => x.id === payoutId) ?? null : null
  const adjustmentReason = new Map((adjustments.data ?? []).map((a) => [a.sales_adjustment_id, a]))
  const commissions = p?.items.filter((i) => i.kind !== 'adjustment') ?? []
  const adjusts = p?.items.filter((i) => i.kind === 'adjustment') ?? []
  const facts: [string, string | null][] = p
    ? [
        ['Approved', day(p.approved_on)],
        ['Paid', day(p.paid_on)],
        ['Invoice', p.invoice_number],
        ['Issued', day(p.invoice_issued_on)],
        ['Due', p.status === 'approved' ? day(p.invoice_due_on) : null],
      ]
    : []
  return (
    <Sheet open={!!payoutId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-0 p-0 sm:max-w-[560px]">
        {payouts.isLoading ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Payout</SheetTitle>
            <Rows n={5} />
          </div>
        ) : !p ? (
          <div className="p-6">
            <SheetTitle className="font-poppins text-[18px] font-semibold text-[#1F2230]">This payout isn't here</SheetTitle>
            <SheetDescription className="mt-2 font-inter text-[13px] leading-[1.55] text-[#5A6072]">
              {payouts.isError
                ? "Couldn't load the payouts. Close this and try again."
                : 'Billing may have taken it back to draft to change it. It comes back once it is approved again.'}
            </SheetDescription>
          </div>
        ) : (
          <>
            <header className="border-b border-[#EFEEEA] px-6 pb-5 pt-6">
              <p className="font-inter text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#6F3FF5]">Payout</p>
              <SheetTitle className="mt-1.5 pr-8 font-poppins text-[22px] font-semibold tracking-[-0.03em] text-[#0d0d09]">
                {monthName(p.month)}
                <span className="text-[#D7C5FB]">.</span>
              </SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 font-inter text-[12.5px] text-[#5A6072]">
                <Dot {...PAYOUT_STATUS[p.status]} />
                <span>· {payoutWhen(p)}</span>
              </SheetDescription>
              <p className="mt-4 font-poppins text-[28px] font-semibold tracking-[-0.03em] text-[#1F2230]">
                <Money amount={p.total} currency={p.currency} />
              </p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <dl className="grid grid-cols-2 gap-2">
                {facts
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5">
                      <dt className="font-inter text-[11px] text-[#6B7080]">{k}</dt>
                      <dd className="mt-0.5 truncate font-inter text-[13px] font-medium tabular-nums text-[#1F2230]">{v}</dd>
                    </div>
                  ))}
              </dl>

              {(p.has_invoice_pdf || p.has_own_invoice) && (
                <section className="mt-5">
                  <h3 className="mb-2 flex items-center gap-2 font-poppins text-[13.5px] font-semibold text-[#1F2230]">
                    <FileText className="h-4 w-4 text-[#6B7080]" aria-hidden /> Invoice
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E7E8EE] px-3.5 py-3">
                    <span className="min-w-0 font-inter text-[12.5px] text-[#5A6072]">
                      {p.invoice_number ? `${p.invoice_number} to Virgilio Technologies LLC` : 'To Virgilio Technologies LLC'}
                    </span>
                    <InvoiceButtons p={p} actions={actions} />
                  </div>
                </section>
              )}

              <section className="mt-5">
                <h3 className="mb-2 flex items-center gap-2 font-poppins text-[13.5px] font-semibold text-[#1F2230]">
                  <Receipt className="h-4 w-4 text-[#6B7080]" aria-hidden /> What's in it
                </h3>
                {p.items.length === 0 ? (
                  <p className="rounded-[12px] bg-[#F7F6F2] px-3.5 py-3 font-inter text-[12.5px] leading-[1.5] text-[#5A6072]">
                    {p.historical
                      ? (p.note ?? 'Paid before Commissions: its lines were kept in Gio Sales only.')
                      : 'Its lines are on the invoice.'}
                  </p>
                ) : (
                  <div className="overflow-clip rounded-[12px] border border-[#E7E8EE]">
                    <ul className="divide-y divide-[#EFEEEA]">
                      {commissions.map((i) => (
                        <li key={i.id} className="flex items-start gap-3 px-3.5 py-2.5">
                          <span className="min-w-0 flex-1 font-inter text-[12.5px] leading-[1.45] text-[#1F2230]">{i.description}</span>
                          <span className="shrink-0 font-inter text-[12.5px] font-medium">
                            <Money amount={i.amount} currency={p.currency} />
                          </span>
                        </li>
                      ))}
                      {adjusts.map((i) => {
                        const a = adjustmentReason.get(i.id)
                        return (
                          <li key={i.id} className="flex items-start gap-3 bg-[#FBFAF7] px-3.5 py-2.5">
                            <span className="min-w-0 flex-1 font-inter text-[12.5px] leading-[1.45] text-[#1F2230]">
                              {i.description}
                              {a && a.reason && !i.description.includes(a.reason) && (
                                <span className="block text-[11.5px] text-[#6B7080]">{a.reason}</span>
                              )}
                            </span>
                            <span className="shrink-0 font-inter text-[12.5px] font-medium">
                              <Money amount={i.amount} currency={p.currency} signed />
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="flex items-center justify-between border-t border-[#E7E8EE] bg-[#FAFAF7] px-3.5 py-2.5 font-inter text-[12.5px]">
                      <span className="text-[#6B7080]">
                        {p.items.length} {p.items.length === 1 ? 'line' : 'lines'}
                      </span>
                      <span className="font-semibold text-[#1F2230]">
                        <Money amount={p.total} currency={p.currency} />
                      </span>
                    </div>
                  </div>
                )}
              </section>
              <p className="mt-4 font-inter text-[11.5px] leading-[1.5] text-[#6B7080]">
                {p.status === 'paid'
                  ? `Paid by bank transfer. It can take a day or two to reach ${self ? 'your' : 'their'} account.`
                  : `Virgilio pays it by bank transfer by the due date. ${self ? 'You get' : 'They get'} an email when it's paid.`}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------- Invoices ----------

export function InvoicesView({ payouts, self, actions, onOpen }: { payouts: Payouts; self: boolean; actions: InvoiceActions; onOpen: (id: string) => void }) {
  const list = (payouts.data ?? [])
    .filter((p) => p.invoice_number || p.has_invoice_pdf || p.has_own_invoice)
    .sort((a, b) => (b.invoice_issued_on ?? b.month).localeCompare(a.invoice_issued_on ?? a.month))
  return (
    <ProfileCard title="Invoices" icon={FileText} tone="blue" flush>
      {payouts.isLoading ? (
        <Rows n={3} />
      ) : payouts.isError ? (
        <div className="p-4">
          <LoadError what={self ? 'your invoices' : 'their invoices'} compact onRetry={() => void payouts.refetch()} />
        </div>
      ) : list.length === 0 ? (
        <Empty>
          No invoices yet. When Billing approves a payout, Gio writes the invoice {self ? 'in your name' : 'in their name'} to Virgilio
          Technologies LLC and it shows here.
        </Empty>
      ) : (
        <div className="max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  <span className="sr-only">Files</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id} {...rowButtonProps(() => onOpen(p.id), `${p.invoice_number ?? monthName(p.month)} invoice`)}>
                  <TableCell className="max-w-[240px]">
                    <span className="block truncate font-medium tabular-nums text-[#1F2230]">{p.invoice_number ?? 'Invoice'}</span>
                    <span className="block truncate text-[11.5px] text-[#6B7080]">
                      {[monthName(p.month), p.invoice_issued_on && `Issued ${day(p.invoice_issued_on)}`].filter(Boolean).join(' · ')}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-[#5A6072] sm:hidden">
                      <Dot {...(p.status === 'paid' ? PAYOUT_STATUS.paid : { label: 'Issued', dot: '#0EA5E9' })} />
                    </span>
                    <div className="mt-2 md:hidden">
                      <InvoiceButtons p={p} actions={actions} compact />
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Dot {...(p.status === 'paid' ? PAYOUT_STATUS.paid : { label: 'Issued', dot: '#0EA5E9' })} />
                    <span className="block text-[11.5px] text-[#6B7080]">{payoutWhen(p)}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">
                    <Money amount={p.total} currency={p.currency} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <InvoiceButtons p={p} actions={actions} compact />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ProfileCard>
  )
}

// ---------- Adjustments ----------

export function AdjustmentsView({
  adjustments,
  payouts,
  self,
  onOpen,
}: {
  adjustments: Adjustments
  payouts: Payouts
  self: boolean
  onOpen: (id: string) => void
}) {
  const bySalesId = new Map((payouts.data ?? []).map((p) => [p.sales_payout_id, p]))
  const list = adjustments.data ?? []
  return (
    <ProfileCard title="Adjustments" icon={SlidersHorizontal} tone="purple" flush>
      {adjustments.isLoading ? (
        <Rows n={3} />
      ) : adjustments.isError ? (
        <div className="p-4">
          <LoadError what={self ? 'your adjustments' : 'their adjustments'} compact onRetry={() => void adjustments.refetch()} />
        </div>
      ) : list.length === 0 ? (
        <Empty>
          No adjustments. A bonus, a correction or a clawback Billing adds to {self ? 'your' : 'their'} pay shows here, with the reason, and
          is paid with that month's payout.
        </Empty>
      ) : (
        <div className="max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adjustment</TableHead>
                <TableHead className="hidden md:table-cell">Payout</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => {
                const payout = a.sales_payout_id ? bySalesId.get(a.sales_payout_id) : undefined
                const where = payout ? (
                  <button
                    type="button"
                    onClick={() => onOpen(payout.id)}
                    className="font-medium text-[#1F2230] underline-offset-2 transition-colors duration-hover hover:text-[#6F3FF5] hover:underline"
                  >
                    {monthName(payout.month)}
                  </button>
                ) : (
                  <span className="text-[#6B7080]">Next payout</span>
                )
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-[320px] sm:max-w-[460px]">
                      <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-[#5A6072]">
                        <Dot label={ADJUSTMENT_LABEL[a.kind] ?? 'Adjustment'} dot={ADJUSTMENT_DOT[a.kind] ?? '#9CA3AF'} />
                        <span className="text-[11.5px] text-[#6B7080]">
                          {[day(a.added_at), monthName(a.month)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="mt-1 block whitespace-pre-line break-words text-[13px] leading-[1.45] text-[#1F2230]">{a.reason}</span>
                      <span className="mt-1 block text-[11.5px] md:hidden">{where}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[12.5px]">{where}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium">
                      <Money amount={a.amount} currency={a.currency} signed />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ProfileCard>
  )
}
