import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencySelect } from '@/components/ui/currency-select'
import { Coins, RefreshCw, Pencil, Trash2, AlertCircle, Lock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

  const overrideByQuote = new Map<string, ReturnType<typeof useCurrencyOverrides>['data'] extends (infer U)[] | undefined ? U : never>()
  ;(overrides.data ?? []).forEach((o) => overrideByQuote.set(o.quote_currency.toUpperCase(), o as any))

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
    return <div className="text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="space-y-6">
      {/* Base currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5" />
            Base currency
          </CardTitle>
          <CardDescription>
            All deal & payment totals across the CRM are reported in this currency.
            Original amounts are always preserved on each deal and payment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-1.5">
              <Label>Workspace base currency</Label>
              <CurrencySelect
                value={baseCurrency}
                onChange={(v) => v !== baseCurrency && setPendingBase(v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rates table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Today's rates</CardTitle>
            <CardDescription>
              {lastRefreshed
                ? `Last refreshed ${formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}`
                : 'No rates loaded yet — click Refresh to fetch them.'}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
            Refresh now
          </Button>
        </CardHeader>
        <CardContent>
          {ratesList.length === 0 && (overrides.data ?? []).length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No exchange rates have been fetched yet. Click <strong>Refresh now</strong> to pull today's
                rates from the European Central Bank feed.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-text-secondary">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Currency</th>
                    <th className="text-right px-3 py-2 font-medium">1 {baseCurrency} =</th>
                    <th className="text-left px-3 py-2 font-medium">Source</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Build row set: union of rates + overrides */}
                  {Array.from(
                    new Set([
                      ...ratesList.map((r) => r.quote_currency.toUpperCase()),
                      ...(overrides.data ?? []).map((o) => o.quote_currency.toUpperCase()),
                    ]),
                  )
                    .sort()
                    .map((quote) => {
                      const auto = ratesList.find((r) => r.quote_currency.toUpperCase() === quote)
                      const override = (overrides.data ?? []).find(
                        (o) => o.quote_currency.toUpperCase() === quote,
                      )
                      const effectiveRate = override?.rate ?? auto?.rate
                      const ccyMeta = CURRENCIES.find((c) => c.value === quote)
                      return (
                        <tr key={quote} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{quote}</div>
                            {ccyMeta && (
                              <div className="text-xs text-text-tertiary">{ccyMeta.label.split(' - ')[1]}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {effectiveRate
                              ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(
                                  effectiveRate,
                                )
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {override ? (
                              <Badge variant="secondary" className="gap-1">
                                <Lock className="h-3 w-3" />
                                Manual
                              </Badge>
                            ) : (
                              <Badge variant="outline">Auto</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openCreateOverride(quote, effectiveRate)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {override && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-virgilio-error hover:text-virgilio-error"
                                  onClick={() => {
                                    if (confirm(`Remove manual override for ${quote}? Auto rate will resume.`))
                                      overrides.remove.mutate(override.id)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button variant="outline" onClick={() => setPendingBase(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBaseChange} disabled={updateBase.isPending}>
              {updateBase.isPending ? 'Saving…' : `Switch to ${pendingBase}`}
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
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveOverride}
              disabled={!overrideRate || Number(overrideRate) <= 0 || overrides.upsert.isPending}
            >
              {overrides.upsert.isPending ? 'Saving…' : 'Save manual rate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
