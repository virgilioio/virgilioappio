
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ExchangeRate {
  id: string
  base_currency: string
  target_currency: string
  rate: number
  rate_date: string
  created_at: string
  updated_at: string
}

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCurrencies = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('supported_currencies')
        .select('*')
        .eq('is_active', true)
        .order('code')

      if (fetchError) {
        throw fetchError
      }

      setCurrencies(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch currencies'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrencies()
  }, [])

  return {
    currencies,
    isLoading,
    error,
    refetch: fetchCurrencies
  }
}

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRates = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('currency_exchange_rates')
        .select('*')
        .order('rate_date', { ascending: false })
        .order('target_currency')

      if (fetchError) {
        throw fetchError
      }

      setRates(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch exchange rates'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateExchangeRates = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('update-exchange-rates')
      
      if (error) {
        throw error
      }

      await fetchRates() // Refresh rates after update
      
      toast({
        title: 'Success',
        description: 'Exchange rates updated successfully'
      })

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update exchange rates'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRates()
  }, [])

  return {
    rates,
    isLoading,
    error,
    refetch: fetchRates,
    updateExchangeRates
  }
}
