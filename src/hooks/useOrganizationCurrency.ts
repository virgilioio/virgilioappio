
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export function useOrganizationCurrency() {
  const { organizationId, userType } = useAuth()
  const [defaultCurrency, setDefaultCurrency] = useState<string>('USD')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizationCurrency = async () => {
    if (!organizationId) return

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('organizations')
        .select('default_currency')
        .eq('id', organizationId)
        .single()

      if (fetchError) {
        throw fetchError
      }

      setDefaultCurrency(data?.default_currency || 'USD')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organization currency'
      setError(errorMessage)
      console.error('Error fetching organization currency:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const updateOrganizationCurrency = async (currency: string) => {
    if (!organizationId) {
      throw new Error('No organization context available')
    }

    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ default_currency: currency })
        .eq('id', organizationId)

      if (updateError) {
        throw updateError
      }

      setDefaultCurrency(currency)
      toast({
        title: 'Success',
        description: 'Organization default currency updated successfully'
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update organization currency'
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

  const getPlatformDefaultCurrency = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'default_currency')
        .single()

      if (error) {
        console.error('Error fetching platform default currency:', error)
        return 'USD'
      }

      return data?.setting_value || 'USD'
    } catch (error) {
      console.error('Error fetching platform default currency:', error)
      return 'USD'
    }
  }

  useEffect(() => {
    if (organizationId) {
      fetchOrganizationCurrency()
    } else if (userType === 'platform_admin') {
      // For platform admins without org context, get platform default
      getPlatformDefaultCurrency().then(setDefaultCurrency)
    }
  }, [organizationId, userType])

  return {
    defaultCurrency,
    isLoading,
    error,
    updateOrganizationCurrency,
    getPlatformDefaultCurrency,
    refetch: fetchOrganizationCurrency
  }
}
