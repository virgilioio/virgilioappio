import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { LucideIcon } from 'lucide-react'

export type EmptyStateAssetType = 
  | 'empty-state-organizations' 
  | 'empty-state-jobs'
  | 'empty-state-candidates'
  | 'empty-state-members'
  | 'empty-state-comments'
  | 'empty-state-attachments'
  | 'empty-state-templates'
  | 'empty-state-independent-candidates'

interface EmptyStateProps {
  assetType: EmptyStateAssetType
  title: string
  description: string
  fallbackIcon: LucideIcon
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  assetType,
  title,
  description,
  fallbackIcon: FallbackIcon,
  action,
  className = ""
}: EmptyStateProps) {
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(true)

  useEffect(() => {
    const fetchCustomImage = async () => {
      try {
        setImageLoading(true)
        const { data, error } = await supabase
          .from('platform_assets')
          .select('file_url')
          .eq('asset_type', assetType)
          .eq('is_active', true)
          .single()

        if (data && !error) {
          setCustomImageUrl(data.file_url)
        }
      } catch (error) {
        // No custom image found, use fallback
        console.log(`No custom ${assetType} image found, using fallback`)
      } finally {
        setImageLoading(false)
      }
    }

    fetchCustomImage()
  }, [assetType])

  const handleImageError = () => {
    setCustomImageUrl(null)
  }

  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-virgilio-purple/10 mx-auto">
        {!imageLoading && customImageUrl ? (
          <img 
            src={customImageUrl}
            alt={`${title} illustration`}
            className="h-full w-full rounded-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <FallbackIcon className="h-8 w-8 text-virgilio-purple" />
        )}
      </div>
      
      <h3 className="text-lg font-poppins font-bold text-virgilio-text mb-2 tracking-page-title">
        {title}<span className="text-purple-period">.</span>
      </h3>
      
      <p className="text-sm text-virgilio-muted mb-6 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      
      {action && (
        <Button onClick={action.onClick} variant="default">
          {action.label}
        </Button>
      )}
    </div>
  )
}