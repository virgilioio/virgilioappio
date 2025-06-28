
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Globe, Coins, RefreshCw, AlertCircle } from 'lucide-react'
import { useCurrencies, useExchangeRates } from '@/hooks/useCurrencies'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrencyAmount } from '@/utils/currencyUtils'
import { supabase } from '@/integrations/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface OrganizationRate {
  target_currency: string
  target_currency_name: string
  target_currency_symbol: string
  rate: number
  rate_date: string
}

export function CurrencySettings() {
  const { currencies } = useCurrencies()
  const { rates, updateExchangeRates, isLoading: ratesLoading } = useExchangeRates()
  const { 
    defaultCurrency, 
    updateOrganizationCurrency, 
    isLoading: currencyLoading 
  } = useOrganizationCurrency()
  const { canManageInvoices } = usePermissions()
  const { organizationId } = useAuth()
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency)
  const [organizationRates, setOrganizationRates] = useState<OrganizationRate[]>([])
  const [orgRatesLoading, setOrgRatesLoading] = useState(false)
  const [orgRatesError, setOrgRatesError] = useState<string | null>(null)

  // Fetch organization-specific exchange rates
  const fetchOrganizationRates = async () => {
    if (!organizationId) return

    setOrgRatesLoading(true)
    setOrgRatesError(null)
    try {
      console.log('Fetching organization exchange rates for org:', organizationId)
      
      const { data, error } = await supabase
        .from('organization_exchange_rates')
        .select('target_currency, target_currency_name, target_currency_symbol, rate, rate_date')
        .eq('organization_id', organizationId)
        .order('target_currency')
        .limit(5)

      if (error) {
        console.error('Error fetching organization rates:', error)
        setOrgRatesError(`Failed to load exchange rates: ${error.message}`)
      } else {
        console.log('Successfully fetched organization rates:', data)
        setOrganizationRates(data || [])
      }
    } catch (error) {
      console.error('Unexpected error fetching organization rates:', error)
      setOrgRatesError('An unexpected error occurred while loading exchange rates')
    } finally {
      setOrgRatesLoading(false)
    }
  }

  useEffect(() => {
    setSelectedCurrency(defaultCurrency)
  }, [defaultCurrency])

  useEffect(() => {
    if (organizationId && defaultCurrency) {
      fetchOrganizationRates()
    }
  }, [organizationId, defaultCurrency])

  const handleSaveCurrency = async () => {
    if (selectedCurrency !== defaultCurrency) {
      await updateOrganizationCurrency(selectedCurrency)
    }
  }

  const handleUpdateRates = async () => {
    try {
      await updateExchangeRates()
      // Refresh organization-specific rates after update
      setTimeout(() => {
        fetchOrganizationRates()
      }, 1000)
    } catch (error) {
      console.error('Failed to update exchange rates:', error)
    }
  }

  // Get recent rates for display (fallback to old behavior)
  const recentRates = rates.filter(rate => rate.base_currency === 'USD').slice(0, 5)
  const lastUpdate = organizationRates[0]?.rate_date || recentRates[0]?.rate_date

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
                {defaultCurrency !== 'USD' && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (from {defaultCurrency})
                  </span>
                )}
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

            {orgRatesError && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {orgRatesError}
                </AlertDescription>
              </Alert>
            )}
            
            {organizationRates.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>Currency</span>
                  <span>Rate (from {defaultCurrency})</span>
                  <span>Example</span>
                </div>
                {organizationRates.map((rate) => (
                  <div key={rate.target_currency} className="grid grid-cols-3 gap-4 text-sm py-2">
                    <span className="font-mono">{rate.target_currency}</span>
                    <span>{rate.rate.toFixed(6)}</span>
                    <span className="text-muted-foreground">
                      1 {defaultCurrency} = {formatCurrencyAmount(rate.rate, rate.target_currency, rate.target_currency_symbol)}
                    </span>
                  </div>
                ))}
              </div>
            ) : orgRatesLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-3 animate-spin" />
                <p className="text-muted-foreground">Loading exchange rates...</p>
              </div>
            ) : recentRates.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-amber-600 mb-3 p-2 bg-amber-50 rounded">
                  Showing USD-based rates. Organization-specific rates will appear after the next update.
                </div>
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
