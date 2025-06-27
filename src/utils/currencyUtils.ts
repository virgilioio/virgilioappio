
import { supabase } from '@/integrations/supabase/client'

export interface ConversionResult {
  convertedAmount: number
  exchangeRate: number
  rateDate: string
  isEstimate: boolean
}

export interface CurrencyDisplayOptions {
  showOriginal?: boolean
  showConversionInfo?: boolean
  precision?: number
}

export const formatCurrencyAmount = (
  amount: number, 
  currencyCode: string, 
  symbol?: string,
  precision: number = 2
): string => {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(amount)

  if (symbol) {
    return `${symbol}${formattedAmount}`
  }
  
  return `${formattedAmount} ${currencyCode}`
}

export const getCurrencySymbol = async (currencyCode: string): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('supported_currencies')
      .select('symbol')
      .eq('code', currencyCode)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.warn(`No symbol found for currency: ${currencyCode}`)
      return currencyCode
    }

    return data.symbol
  } catch (error) {
    console.error('Error fetching currency symbol:', error)
    return currencyCode
  }
}

export const getLatestExchangeRate = async (
  fromCurrency: string, 
  toCurrency: string
): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return 1.0
  }

  try {
    // Try direct rate first
    const { data: directRate, error: directError } = await supabase
      .from('currency_exchange_rates')
      .select('rate, rate_date')
      .eq('base_currency', fromCurrency)
      .eq('target_currency', toCurrency)
      .order('rate_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!directError && directRate) {
      return directRate.rate
    }

    // Try inverse rate
    const { data: inverseRate, error: inverseError } = await supabase
      .from('currency_exchange_rates')
      .select('rate, rate_date')
      .eq('base_currency', toCurrency)
      .eq('target_currency', fromCurrency)
      .order('rate_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!inverseError && inverseRate) {
      return 1.0 / inverseRate.rate
    }

    console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`)
    return 1.0
  } catch (error) {
    console.error('Error fetching exchange rate:', error)
    return 1.0
  }
}

export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<ConversionResult> => {
  if (fromCurrency === toCurrency) {
    return {
      convertedAmount: amount,
      exchangeRate: 1.0,
      rateDate: new Date().toISOString(),
      isEstimate: false
    }
  }

  const rate = await getLatestExchangeRate(fromCurrency, toCurrency)
  const convertedAmount = amount * rate

  // Get rate date for transparency
  const { data: rateData } = await supabase
    .from('currency_exchange_rates')
    .select('rate_date')
    .or(`and(base_currency.eq.${fromCurrency},target_currency.eq.${toCurrency}),and(base_currency.eq.${toCurrency},target_currency.eq.${fromCurrency})`)
    .order('rate_date', { ascending: false })
    .limit(1)
    .single()

  return {
    convertedAmount,
    exchangeRate: rate,
    rateDate: rateData?.rate_date || new Date().toISOString(),
    isEstimate: rate === 1.0 // If rate is 1.0, it might be a fallback
  }
}

export const formatCurrencyWithConversion = (
  originalAmount: number,
  originalCurrency: string,
  displayCurrency: string,
  originalSymbol: string,
  displaySymbol: string,
  exchangeRate?: number,
  options: CurrencyDisplayOptions = {}
): string => {
  const { showOriginal = false, showConversionInfo = false, precision = 2 } = options

  if (originalCurrency === displayCurrency || !exchangeRate) {
    return formatCurrencyAmount(originalAmount, originalCurrency, originalSymbol, precision)
  }

  const convertedAmount = originalAmount * exchangeRate
  const displayAmount = formatCurrencyAmount(convertedAmount, displayCurrency, displaySymbol, precision)

  if (!showOriginal && !showConversionInfo) {
    return displayAmount
  }

  let result = displayAmount

  if (showOriginal) {
    const originalDisplay = formatCurrencyAmount(originalAmount, originalCurrency, originalSymbol, precision)
    result += ` (${originalDisplay})`
  }

  if (showConversionInfo) {
    result += ` @ ${exchangeRate.toFixed(6)}`
  }

  return result
}
