import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export function useFeatureFlag(flagName: string): boolean {
  const [isActive, setIsActive] = useState(false)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      setIsActive(false)
      return
    }

    const fetchFlag = async () => {
      try {
        const { data, error } = await supabase.rpc('get_feature_flag', {
          flag_name_param: flagName
        })
        
        if (error) {
          console.error('Error fetching feature flag:', error)
          setIsActive(false)
        } else {
          setIsActive(data || false)
        }
      } catch (err) {
        console.error('Error fetching feature flag:', err)
        setIsActive(false)
      }
    }

    fetchFlag()

    // Set up real-time subscription for flag changes
    const subscription = supabase
      .channel('feature_flags')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_feature_flags',
          filter: `flag_name=eq.${flagName}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setIsActive(payload.new.is_active || false)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [flagName, isAuthenticated])

  return isActive
}