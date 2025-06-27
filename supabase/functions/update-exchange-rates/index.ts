
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const exchangeRateApiKey = Deno.env.get('EXCHANGE_RATE_API_KEY')
    if (!exchangeRateApiKey) {
      throw new Error('Exchange Rate API key not configured')
    }

    // Base currency is USD for simplicity
    const baseCurrency = 'USD'
    const apiUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/${baseCurrency}`

    console.log('Fetching exchange rates from:', apiUrl)

    // Fetch rates from Exchange Rates API
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Exchange Rate API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.result !== 'success') {
      throw new Error(`Exchange Rate API returned error: ${data['error-type']}`)
    }

    const rates = data.conversion_rates
    const rateDate = new Date().toISOString().split('T')[0] // Today's date

    console.log('Received rates for', Object.keys(rates).length, 'currencies')

    // Get supported currencies from our database
    const { data: supportedCurrencies, error: currenciesError } = await supabase
      .from('supported_currencies')
      .select('code')
      .eq('is_active', true)

    if (currenciesError) {
      throw new Error(`Failed to fetch supported currencies: ${currenciesError.message}`)
    }

    const supportedCodes = supportedCurrencies.map(c => c.code)
    let insertedCount = 0
    let updatedCount = 0

    // Insert/update rates for supported currencies
    for (const currency of supportedCodes) {
      if (currency === baseCurrency) continue // Skip base currency
      
      const rate = rates[currency]
      if (!rate) {
        console.warn(`No rate found for currency: ${currency}`)
        continue
      }

      // Try to insert, on conflict update
      const { error: upsertError } = await supabase
        .from('currency_exchange_rates')
        .upsert({
          base_currency: baseCurrency,
          target_currency: currency,
          rate: rate,
          rate_date: rateDate
        }, {
          onConflict: 'base_currency,target_currency,rate_date'
        })

      if (upsertError) {
        console.error(`Failed to upsert rate for ${currency}:`, upsertError)
        continue
      }

      // Check if this was an insert or update by looking for existing record
      const { data: existing } = await supabase
        .from('currency_exchange_rates')
        .select('id')
        .eq('base_currency', baseCurrency)
        .eq('target_currency', currency)
        .eq('rate_date', rateDate)
        .single()

      if (existing) {
        updatedCount++
      } else {
        insertedCount++
      }
    }

    const result = {
      success: true,
      message: `Exchange rates updated successfully`,
      stats: {
        inserted: insertedCount,
        updated: updatedCount,
        total_currencies: supportedCodes.length,
        rate_date: rateDate,
        base_currency: baseCurrency
      }
    }

    console.log('Exchange rates update completed:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Exchange rates update failed:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
