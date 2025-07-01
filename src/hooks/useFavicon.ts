
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

        if (data && !error && data.file_url) {
          // Validate URL before setting it
          const isValidUrl = data.file_url.startsWith('http') || data.file_url.startsWith('/') || data.file_url.startsWith('data:')
          
          if (isValidUrl) {
            // Add cache-busting parameter for mobile browsers
            const cacheBustedUrl = `${data.file_url}?v=${Date.now()}`
            
            // Update all favicon-related links
            const faviconSelectors = [
              "link[rel*='icon']",
              "link[rel='shortcut icon']",
              "link[rel='apple-touch-icon']",
              "link[sizes='16x16']",
              "link[sizes='32x32']",
              "link[sizes='48x48']",
              "link[sizes='57x57']",
              "link[sizes='60x60']",
              "link[sizes='72x72']",
              "link[sizes='76x76']",
              "link[sizes='114x114']",
              "link[sizes='120x120']",
              "link[sizes='144x144']",
              "link[sizes='152x152']",
              "link[sizes='180x180']",
              "link[sizes='192x192']",
              "link[sizes='512x512']"
            ]

            faviconSelectors.forEach(selector => {
              const links = document.querySelectorAll(selector) as NodeListOf<HTMLLinkElement>
              links.forEach(link => {
                link.href = cacheBustedUrl
              })
            })

            // Update Microsoft Tile meta tag
            const tileImage = document.querySelector("meta[name='msapplication-TileImage']") as HTMLMetaElement
            if (tileImage) {
              tileImage.content = cacheBustedUrl
            }

            // Force refresh favicon for mobile browsers
            const head = document.head || document.getElementsByTagName('head')[0]
            
            // Create a temporary link to force reload
            const tempLink = document.createElement('link')
            tempLink.rel = 'icon'
            tempLink.href = cacheBustedUrl
            head.appendChild(tempLink)
            
            // Remove after a brief delay
            setTimeout(() => {
              if (head.contains(tempLink)) {
                head.removeChild(tempLink)
              }
            }, 100)

            console.log('Favicon updated for all devices:', cacheBustedUrl)
          } else {
            console.warn('Invalid favicon URL:', data.file_url)
          }
        } else {
          console.log('No custom favicon found, using default')
        }
      } catch (error) {
        console.log('Using default favicon - favicon loading failed:', error)
        
        // Retry logic for mobile networks
        setTimeout(() => {
          console.log('Retrying favicon load...')
          updateFavicon()
        }, 2000)
      }
    }

    // Initial load
    updateFavicon()
    
    // Listen for page visibility changes (mobile apps coming back to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateFavicon()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
