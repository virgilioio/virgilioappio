import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencySelect } from '@/components/ui/currency-select'
import { RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { useBaseCurrency } from '@/hooks/useBaseCurrency'
import { useCurrencyRates, useCurrencyOverrides, useRefreshFxRates } from '@/hooks/useCurrencyRates'
import { CURRENCIES } from '@/constants/currencies'
import { formatDistanceToNow } from 'date-fns'

export function CurrencySettings() {
  const { baseCurrency, update: updateBase, isLoading } = useBaseCurrency()
  const rates = useCurrencyRates()
  const overrides = useCurrencyOverrides()
  const refresh = useRefreshFxRates()

  const [pendingBase, setPendingBase] = useState<string | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideQuote, setOverrideQuote] = useState<string>('')
  const [overrideRate, setOverrideRate] = useState<string>('')
  const [overrideNote, setOverrideNote] = useState<string>('')

  const openCreateOverride = (quote: string, currentRate?: number) => {
    setOverrideQuote(quote)
    setOverrideRate(currentRate ? String(currentRate) : '')
    setOverrideNote('')
    setOverrideOpen(true)
  }

  const handleSaveOverride = async () => {
    const r = Number(overrideRate)
    if (!overrideQuote || !r || r <= 0) return
    await overrides.upsert.mutateAsync({
      quote_currency: overrideQuote,
      rate: r,
      note: overrideNote.trim() || null,
    })
    setOverrideOpen(false)
  }

  const handleConfirmBaseChange = async () => {
    if (!pendingBase) return
    await updateBase.mutateAsync(pendingBase)
    setPendingBase(null)
  }

  const ratesList = rates.data?.rates ?? []
  const lastRefreshed = rates.data?.lastRefreshed

  if (isLoading) {
    return (
      <SettingsCard title="Base currency">
        <p className="font-inter text-[12px] text-[#8B8F9E] py-4 text-center">Loading…</p>
      </SettingsCard>
    )
  }

  const allQuotes = Array.from(
    new Set([
      ...ratesList.map((r) => r.quote_currency.toUpperCase()),
      ...(overrides.data ?? []).map((o) => o.quote_currency.toUpperCase()),
    ]),
  ).sort()

  return (
    <>
      <SettingsCard
        title="Base currency"
        description="All deal & payment totals report in this currency. Original amounts are preserved per deal."
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            loading={refresh.isPending}
          >
            Refresh rates
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Base currency selector row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="min-w-[240px] max-w-[280px] flex-1">
              <Label className="sr-only">Workspace base currency</Label>
              <CurrencySelect
                value={baseCurrency}
                onChange={(v) => v !== baseCurrency && setPendingBase(v)}
              />
            </div>
            <p className="font-inter text-[12px] text-[#8B8F9E]">
              {lastRefreshed
                ? `Rates refreshed ${formatDistanceToNow(new Date(lastRefreshed))} ago`
                : 'No rates loaded yet'}
            </p>
          </div>

          {/* Rates list */}
          {allQuotes.length > 0 && (
            <div className="border-t border-[#EFEFEA] pt-1">
              {allQuotes.map((quote) => {
                const auto = ratesList.find((r) => r.quote_currency.toUpperCase() === quote)
                const override = (overrides.data ?? []).find(
                  (o) => o.quote_currency.toUpperCase() === quote,
                )
                const effectiveRate = override?.rate ?? auto?.rate
                const ccyMeta = CURRENCIES.find((c) => c.value === quote)
                const ccyName = ccyMeta?.label.split(' - ')[1] ?? quote
                return (
                  <div
                    key={quote}
                    className="group flex items-center justify-between py-3 border-b border-[#EFEFEA] last:border-b-0"
                  >
                    <div className="font-inter text-[13px] text-[#0d0d09]">
                      <span className="font-medium">{quote}</span>
                      <span className="text-[#8B8F9E] mx-1.5">·</span>
                      <span className="text-[#5A6072]">{ccyName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-inter text-[13px] text-[#0d0d09] tabular-nums">
                        <span className="text-[#8B8F9E]">1 {baseCurrency} = </span>
                        <span className="font-medium">
                          {effectiveRate
                            ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(effectiveRate)
                            : '—'}
                        </span>
                      </div>
                      <Badge tone={override ? 'purple' : 'neutral'} size="xs">
                        {override ? 'Manual' : 'Auto'}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={Pencil}
                          iconOnly
                          aria-label={`Edit ${quote} rate`}
                          onClick={() => openCreateOverride(quote, effectiveRate)}
                        />
                        {override && (
                          <Button
                            size="xs"
                            variant="ghost"
                            icon={Trash2}
                            iconOnly
                            aria-label={`Remove ${quote} override`}
                            onClick={() => {
                              if (confirm(`Remove manual override for ${quote}? Auto rate will resume.`))
                                overrides.remove.mutate(override.id)
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Confirm base-currency change */}
      <Dialog open={!!pendingBase} onOpenChange={(o) => !o && setPendingBase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change base currency to {pendingBase}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>
              Every deal & payment total across the CRM will be re-expressed in <strong>{pendingBase}</strong>.
              Original amounts and historic payment FX rates stay untouched.
            </p>
            <p>You may need to refresh exchange rates after switching.</p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingBase(null)}>Cancel</Button>
            <Button onClick={handleConfirmBaseChange} disabled={updateBase.isPending} loading={updateBase.isPending}>
              Switch to {pendingBase}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override modal */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set manual rate for {overrideQuote}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={overrideQuote} onValueChange={setOverrideQuote}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.filter((c) => c.value !== baseCurrency).map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>1 {baseCurrency} = ? {overrideQuote}</Label>
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="e.g. Contractual rate locked with Acme"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveOverride}
              disabled={!overrideRate || Number(overrideRate) <= 0 || overrides.upsert.isPending}
              loading={overrides.upsert.isPending}
            >
              Save manual rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
