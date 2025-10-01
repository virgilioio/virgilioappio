

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
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

      // Check if setting exists
      const existingSetting = settings.find(s => s.setting_key === settingKey)
      
      if (existingSetting) {
        // Update existing setting
        const { error } = await supabase
          .from('platform_settings')
          .update({ 
            setting_value: value,
            updated_by: userId
          })
          .eq('setting_key', settingKey)

        if (error) {
          console.error('Update error:', error)
          throw error
        }
      } else {
        // Insert new setting - this shouldn't happen with our current setup but adding as fallback
        const { error } = await supabase
          .from('platform_settings')
          .insert({
            setting_key: settingKey,
            setting_value: value,
            setting_type: 'html',
            display_name: settingKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            updated_by: userId
          })

        if (error) {
          console.error('Insert error:', error)
          throw error
        }
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

