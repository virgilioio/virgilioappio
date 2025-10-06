
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

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

    // Get all unique organization default currencies
    const { data: orgCurrencies, error: orgCurrenciesError } = await supabase
      .rpc('get_active_organization_currencies')

    if (orgCurrenciesError) {
      console.error('Failed to fetch organization currencies:', orgCurrenciesError)
      throw new Error(`Failed to fetch organization currencies: ${orgCurrenciesError.message}`)
    }

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

    // Always include USD as a base currency for triangulation
    const baseCurrencies = new Set(['USD'])
    
    // Add organization default currencies as base currencies
    if (orgCurrencies && orgCurrencies.length > 0) {
      orgCurrencies.forEach((org: any) => {
        if (org.currency_code && supportedCodes.includes(org.currency_code)) {
          baseCurrencies.add(org.currency_code)
        }
      })
    }

    console.log('Base currencies to fetch:', Array.from(baseCurrencies))
    
    let totalInserted = 0
    let totalUpdated = 0
    let totalErrors = 0
    const rateDate = new Date().toISOString().split('T')[0]

    // Fetch rates for each base currency
    for (const baseCurrency of baseCurrencies) {
      console.log(`\n--- Fetching rates for base currency: ${baseCurrency} ---`)
      
      const apiUrl = `https://v6.exchangerate-api.com/v6/${exchangeRateApiKey}/latest/${baseCurrency}`

      try {
        console.log('Fetching exchange rates from API...')
        const response = await fetch(apiUrl)
        console.log('API Response status:', response.status)
        
        if (!response.ok) {
          const responseText = await response.text()
          console.error(`API Response error for ${baseCurrency}:`, responseText)
          totalErrors++
          continue
        }

        const data = await response.json()
        console.log('API Response result:', data.result)
        
        if (data.result !== 'success') {
          console.error(`API returned error result for ${baseCurrency}:`, data)
          totalErrors++
          continue
        }

        const rates = data.conversion_rates
        console.log(`Received rates for ${Object.keys(rates).length} currencies from ${baseCurrency}`)

        let insertedCount = 0
        let updatedCount = 0
        let errorCount = 0

        // Insert/update rates for supported currencies
        for (const targetCurrency of supportedCodes) {
          if (targetCurrency === baseCurrency) continue // Skip base currency
          
          const rate = rates[targetCurrency]
          if (!rate) {
            console.warn(`No rate found for ${baseCurrency} -> ${targetCurrency}`)
            errorCount++
            continue
          }

          try {
            // Check if record exists for today
            const { data: existingRate } = await supabase
              .from('currency_exchange_rates')
              .select('id')
              .eq('base_currency', baseCurrency)
              .eq('target_currency', targetCurrency)
              .eq('rate_date', rateDate)
              .maybeSingle()

            if (existingRate) {
              // Update existing rate
              const { error: updateError } = await supabase
                .from('currency_exchange_rates')
                .update({ rate: rate, updated_at: new Date().toISOString() })
                .eq('id', existingRate.id)

              if (updateError) {
                console.error(`Failed to update rate for ${baseCurrency} -> ${targetCurrency}:`, updateError)
                errorCount++
                continue
              }
              updatedCount++
              console.log(`Updated rate for ${baseCurrency} -> ${targetCurrency}: ${rate}`)
            } else {
              // Insert new rate
              const { error: insertError } = await supabase
                .from('currency_exchange_rates')
                .insert({
                  base_currency: baseCurrency,
                  target_currency: targetCurrency,
                  rate: rate,
                  rate_date: rateDate
                })

              if (insertError) {
                console.error(`Failed to insert rate for ${baseCurrency} -> ${targetCurrency}:`, insertError)
                errorCount++
                continue
              }
              insertedCount++
              console.log(`Inserted new rate for ${baseCurrency} -> ${targetCurrency}: ${rate}`)
            }
          } catch (dbError) {
            console.error(`Database error for ${baseCurrency} -> ${targetCurrency}:`, dbError)
            errorCount++
          }
        }

        totalInserted += insertedCount
        totalUpdated += updatedCount
        totalErrors += errorCount

        console.log(`Base currency ${baseCurrency} completed: ${insertedCount} inserted, ${updatedCount} updated, ${errorCount} errors`)

      } catch (fetchError) {
        console.error(`Failed to fetch rates for base currency ${baseCurrency}:`, fetchError)
        totalErrors++
      }
    }

    const result = {
      success: true,
      message: `Exchange rates updated successfully for ${baseCurrencies.size} base currencies`,
      stats: {
        inserted: totalInserted,
        updated: totalUpdated,
        errors: totalErrors,
        base_currencies_processed: baseCurrencies.size,
        supported_currencies: supportedCodes.length,
        rate_date: rateDate
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
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        error_type: error instanceof Error ? error.name || 'UnknownError' : 'UnknownError'
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
