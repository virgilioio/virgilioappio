
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
    console.log('Exchange Rate API Key present:', !!exchangeRateApiKey)
    
    if (!exchangeRateApiKey) {
      throw new Error('Exchange Rate API key not configured')
    }

    // Base currency is USD for simplicity
    const baseCurrency = 'USD'
    const apiUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/${baseCurrency}`

    console.log('Fetching exchange rates from API...')

    // Fetch rates from Exchange Rates API
    const response = await fetch(apiUrl)
    console.log('API Response status:', response.status)
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()))
    
    if (!response.ok) {
      const responseText = await response.text()
      console.error('API Response error body:', responseText)
      throw new Error(`Exchange Rate API error: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const data = await response.json()
    console.log('API Response data keys:', Object.keys(data))
    
    if (data.result !== 'success') {
      console.error('API returned error result:', data)
      throw new Error(`Exchange Rate API returned error: ${data['error-type']} - ${data['error-message'] || 'Unknown error'}`)
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
    console.log('Supported currencies:', supportedCodes)
    
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

      // Check if record exists for today
      const { data: existingRate } = await supabase
        .from('currency_exchange_rates')
        .select('id')
        .eq('base_currency', baseCurrency)
        .eq('target_currency', currency)
        .eq('rate_date', rateDate)
        .single()

      if (existingRate) {
        // Update existing rate
        const { error: updateError } = await supabase
          .from('currency_exchange_rates')
          .update({ rate: rate, updated_at: new Date().toISOString() })
          .eq('id', existingRate.id)

        if (updateError) {
          console.error(`Failed to update rate for ${currency}:`, updateError)
          continue
        }
        updatedCount++
      } else {
        // Insert new rate
        const { error: insertError } = await supabase
          .from('currency_exchange_rates')
          .insert({
            base_currency: baseCurrency,
            target_currency: currency,
            rate: rate,
            rate_date: rateDate
          })

        if (insertError) {
          console.error(`Failed to insert rate for ${currency}:`, insertError)
          continue
        }
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
