
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export function useOrganizationCurrency() {
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [isLoading, setIsLoading] = useState(false)
  const { user, organizationId } = useAuth()
  const { toast } = useToast()

  const fetchOrganizationCurrency = async () => {
    if (!user || !organizationId) {
      console.log('=== ORGANIZATION CURRENCY DEBUG ===')
      console.log('No user or organizationId available:', { user: !!user, organizationId })
      return
    }

    try {
      console.log('=== FETCHING ORGANIZATION CURRENCY ===')
      console.log('Organization ID:', organizationId)

      const { data: organization, error } = await supabase
        .from('organizations')
        .select('default_currency, name, organization_type')
        .eq('id', organizationId)
        .single()

      if (error) {
        console.error('Error fetching organization currency:', error)
        return
      }

      console.log('Organization data:', organization)
      console.log('Current default_currency from DB:', organization?.default_currency)
      console.log('Organization name:', organization?.name)
      console.log('Organization type:', organization?.organization_type)

      if (organization?.default_currency) {
        console.log('Setting defaultCurrency to:', organization.default_currency)
        setDefaultCurrency(organization.default_currency)
      } else {
        console.log('No default_currency found, using USD fallback')
        setDefaultCurrency('USD')
      }
    } catch (error) {
      console.error('Error fetching organization currency:', error)
    }
  }

  const updateOrganizationCurrency = async (currencyCode: string) => {
    if (!user || !organizationId) return false

    setIsLoading(true)
    try {
      console.log('=== UPDATING ORGANIZATION CURRENCY ===')
      console.log('Updating to currency:', currencyCode)
      console.log('Organization ID:', organizationId)

      const { error } = await supabase
        .from('organizations')
        .update({ default_currency: currencyCode })
        .eq('id', organizationId)

      if (error) {
        throw error
      }

      setDefaultCurrency(currencyCode)
      console.log('Successfully updated organization currency to:', currencyCode)
      
      toast({
        title: 'Success',
        description: 'Default currency updated successfully'
      })
      return true
    } catch (error) {
      console.error('Error updating organization currency:', error)
      toast({
        title: 'Error',
        description: 'Failed to update default currency',
        variant: 'destructive'
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizationCurrency()
  }, [user, organizationId])

  // Add debug logging whenever defaultCurrency changes
  useEffect(() => {
    console.log('=== DEFAULT CURRENCY CHANGED ===')
    console.log('New defaultCurrency:', defaultCurrency)
    console.log('User:', user?.email)
    console.log('Organization ID:', organizationId)
  }, [defaultCurrency, user, organizationId])

  return {
    defaultCurrency,
    updateOrganizationCurrency,
    isLoading
  }
}
