
import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useFavicon() {
  useEffect(() => {
    const updateFavicon = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_assets')
          .select('file_url')
          .eq('asset_type', 'favicon')
          .eq('is_active', true)
          .single()

        if (data && !error) {
          // Update the favicon link in the document head
          let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
          
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
          }
          
          link.href = data.file_url
          
          // Also update any shortcut icon links
          const shortcutLink = document.querySelector("link[rel='shortcut icon']") as HTMLLinkElement
          if (shortcutLink) {
            shortcutLink.href = data.file_url
          }
        }
      } catch (error) {
        console.log('Using default favicon - no custom favicon found')
      }
    }

    updateFavicon()
  }, [])
}
