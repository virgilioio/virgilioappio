
import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useBrowserTitle() {
  useEffect(() => {
    const updateBrowserTitle = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'browser_title')
          .single()

        if (data && !error && data.setting_value) {
          document.title = data.setting_value
        }
      } catch (error) {
        console.log('Using default browser title - no custom title found')
      }
    }

    updateBrowserTitle()
  }, [])
}
