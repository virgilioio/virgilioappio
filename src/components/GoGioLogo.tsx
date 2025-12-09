import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface GoGioLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function GoGioLogo({ size = 'md', className = '' }: GoGioLogoProps) {
  const [logoUrl, setLogoUrl] = useState('/gogio-logo.png')
  
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const logoHeight = sizeMap[size];

  useEffect(() => {
    // Fetch current active logo from platform assets
    const fetchLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_assets')
          .select('file_url')
          .eq('asset_type', 'logo')
          .eq('is_active', true)
          .single()

        if (data && !error) {
          setLogoUrl(data.file_url)
        }
      } catch (error) {
        console.log('Using default logo - no custom logo found')
        // Keep default logo if no custom one is found
      }
    }

    fetchLogo()
  }, [])

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={logoUrl} 
        alt="GoGio"
        height={logoHeight}
        className="h-auto"
        style={{ height: `${logoHeight}px` }}
        onError={() => setLogoUrl('/gogio-logo.png')} // Fallback to default on error
      />
    </div>
  );
}
