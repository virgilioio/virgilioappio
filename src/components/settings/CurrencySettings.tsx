
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Globe, Coins, RefreshCw } from 'lucide-react'
import { useCurrencies, useExchangeRates } from '@/hooks/useCurrencies'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrencyAmount } from '@/utils/currencyUtils'

export function CurrencySettings() {
  const { currencies } = useCurrencies()
  const { rates, updateExchangeRates, isLoading: ratesLoading } = useExchangeRates()
  const { 
    defaultCurrency, 
    updateOrganizationCurrency, 
    isLoading: currencyLoading 
  } = useOrganizationCurrency()
  const { canManageInvoices } = usePermissions()
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency)

  const handleSaveCurrency = async () => {
    if (selectedCurrency !== defaultCurrency) {
      await updateOrganizationCurrency(selectedCurrency)
    }
  }

  const handleUpdateRates = async () => {
    try {
      await updateExchangeRates()
    } catch (error) {
      console.error('Failed to update exchange rates:', error)
    }
  }

  // Get recent rates for display
  const recentRates = rates.filter(rate => rate.base_currency === 'USD').slice(0, 5)
  const lastUpdate = recentRates[0]?.rate_date

  return (
    <div className="space-y-6">
      {/* Currency Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Currency Preference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency-select">Default Currency</Label>
            <div className="flex gap-3">
              <Select
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
                disabled={currencyLoading}
              >
                <SelectTrigger id="currency-select" className="flex-1">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{currency.symbol}</span>
                        <span>{currency.code}</span>
                        <span className="text-muted-foreground">- {currency.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                onClick={handleSaveCurrency}
                disabled={currencyLoading || selectedCurrency === defaultCurrency}
                size="default"
              >
                {currencyLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This currency will be used as the default for displaying invoice amounts in your organization.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      {canManageInvoices && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Exchange Rates
              </CardTitle>
              <Button
                onClick={handleUpdateRates}
                disabled={ratesLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${ratesLoading ? 'animate-spin' : ''}`} />
                Update Rates
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lastUpdate && (
              <p className="text-sm text-muted-foreground mb-4">
                Last updated: {new Date(lastUpdate).toLocaleDateString()}
              </p>
            )}
            
            {recentRates.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>Currency</span>
                  <span>Rate (from USD)</span>
                  <span>Example</span>
                </div>
                {recentRates.map((rate) => (
                  <div key={rate.id} className="grid grid-cols-3 gap-4 text-sm py-2">
                    <span className="font-mono">{rate.target_currency}</span>
                    <span>{rate.rate.toFixed(6)}</span>
                    <span className="text-muted-foreground">
                      $100 = {formatCurrencyAmount(100 * rate.rate, rate.target_currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Coins className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No exchange rates available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Update Rates" to fetch the latest exchange rates
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
