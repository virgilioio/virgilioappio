
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
    console.log('=== Exchange Rates Update Started ===')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const exchangeRateApiKey = Deno.env.get('EXCHANGE_RATE_API_KEY')
    
    console.log('Environment check:')
    console.log('- SUPABASE_URL present:', !!supabaseUrl)
    console.log('- SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseKey)
    console.log('- EXCHANGE_RATE_API_KEY present:', !!exchangeRateApiKey)
    
    if (!exchangeRateApiKey) {
      console.error('EXCHANGE_RATE_API_KEY environment variable is not set')
      throw new Error('Exchange Rate API key not configured')
    }

    // Base currency is USD for simplicity
    const baseCurrency = 'USD'
    const apiUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/${baseCurrency}`

    console.log('Fetching exchange rates from API...')

    // Fetch rates from Exchange Rates API
    const response = await fetch(apiUrl)
    console.log('API Response status:', response.status)
    
    if (!response.ok) {
      const responseText = await response.text()
      console.error('API Response error:', responseText)
      
      try {
        const errorData = JSON.parse(responseText)
        console.error('Parsed error data:', errorData)
        throw new Error(`Exchange Rate API error: ${response.status} - ${errorData['error-type'] || 'Unknown error'}: ${errorData['extra-info'] || responseText}`)
      } catch (parseError) {
        throw new Error(`Exchange Rate API error: ${response.status} ${response.statusText} - ${responseText}`)
      }
    }

    const data = await response.json()
    console.log('API Response result:', data.result)
    
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
      console.error('Failed to fetch supported currencies:', currenciesError)
      throw new Error(`Failed to fetch supported currencies: ${currenciesError.message}`)
    }

    if (!supportedCurrencies || supportedCurrencies.length === 0) {
      console.error('No supported currencies found in database')
      throw new Error('No supported currencies found')
    }

    const supportedCodes = supportedCurrencies.map(c => c.code)
    console.log('Supported currencies:', supportedCodes)
    
    let insertedCount = 0
    let updatedCount = 0
    let errorCount = 0

    // Insert/update rates for supported currencies
    for (const currency of supportedCodes) {
      if (currency === baseCurrency) continue // Skip base currency
      
      const rate = rates[currency]
      if (!rate) {
        console.warn(`No rate found for currency: ${currency}`)
        errorCount++
        continue
      }

      try {
        // Check if record exists for today
        const { data: existingRate } = await supabase
          .from('currency_exchange_rates')
          .select('id')
          .eq('base_currency', baseCurrency)
          .eq('target_currency', currency)
          .eq('rate_date', rateDate)
          .maybeSingle()

        if (existingRate) {
          // Update existing rate
          const { error: updateError } = await supabase
            .from('currency_exchange_rates')
            .update({ rate: rate, updated_at: new Date().toISOString() })
            .eq('id', existingRate.id)

          if (updateError) {
            console.error(`Failed to update rate for ${currency}:`, updateError)
            errorCount++
            continue
          }
          updatedCount++
          console.log(`Updated rate for ${currency}: ${rate}`)
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
            errorCount++
            continue
          }
          insertedCount++
          console.log(`Inserted new rate for ${currency}: ${rate}`)
        }
      } catch (dbError) {
        console.error(`Database error for ${currency}:`, dbError)
        errorCount++
      }
    }

    const result = {
      success: true,
      message: `Exchange rates updated successfully`,
      stats: {
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
        total_currencies: supportedCodes.length,
        rate_date: rateDate,
        base_currency: baseCurrency
      }
    }

    console.log('=== Exchange rates update completed ===')
    console.log('Final result:', result)

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
    console.error('=== Exchange rates update failed ===')
    console.error('Error details:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        error_type: error.name || 'UnknownError'
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
