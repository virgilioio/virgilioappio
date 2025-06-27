
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export function useOrganizationCurrency() {
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchOrganizationCurrency = async () => {
    if (!user) return

    try {
      const { data: member } = await supabase
        .from('members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (member?.organization_id) {
        const { data: organization } = await supabase
          .from('organizations')
          .select('default_currency')
          .eq('id', member.organization_id)
          .single()

        if (organization?.default_currency) {
          setDefaultCurrency(organization.default_currency)
        }
      }
    } catch (error) {
      console.error('Error fetching organization currency:', error)
    }
  }

  const updateOrganizationCurrency = async (currencyCode: string) => {
    if (!user) return false

    setIsLoading(true)
    try {
      const { data: member } = await supabase
        .from('members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (member?.organization_id) {
        const { error } = await supabase
          .from('organizations')
          .update({ default_currency: currencyCode })
          .eq('id', member.organization_id)

        if (error) {
          throw error
        }

        setDefaultCurrency(currencyCode)
        toast({
          title: 'Success',
          description: 'Default currency updated successfully'
        })
        return true
      }
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
  }, [user])

  return {
    defaultCurrency,
    updateOrganizationCurrency,
    isLoading
  }
}
