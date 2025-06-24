
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface PlatformSetting {
  id: string
  setting_key: string
  setting_value: string | null
  setting_type: string
  display_name: string
  description: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('setting_key')

      if (error) throw error

      setSettings(data || [])
    } catch (error) {
      console.error('Error fetching platform settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch platform settings',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = async (settingKey: string, value: string) => {
    try {
      setIsUpdating(true)
      
      const currentUser = await supabase.auth.getUser()
      const userId = currentUser.data.user?.id

      // Use upsert to handle both insert and update cases
      const { error } = await supabase
        .from('platform_settings')
        .upsert({ 
          setting_key: settingKey,
          setting_value: value,
          updated_by: userId
        }, {
          onConflict: 'setting_key'
        })

      if (error) {
        console.error('Upsert error:', error)
        throw error
      }

      toast({
        title: 'Success',
        description: 'Setting updated successfully'
      })

      // Refresh settings
      await fetchSettings()
      
      // If browser title was updated, update the document title immediately
      if (settingKey === 'browser_title') {
        document.title = value
      }

      return true
    } catch (error: any) {
      console.error('Error updating setting:', error)
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update setting',
        variant: 'destructive'
      })
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  const getSetting = useCallback((key: string) => {
    return settings.find(setting => setting.setting_key === key)
  }, [settings])

  useEffect(() => {
    fetchSettings()
  }, [])

  return {
    settings,
    isLoading,
    isUpdating,
    updateSetting,
    getSetting,
    refetchSettings: fetchSettings
  }
}
