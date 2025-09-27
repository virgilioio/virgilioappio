import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
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
    <div className={`text-center py-8 ${className}`}>
      <div className="mb-4">
        {!imageLoading && customImageUrl ? (
          <img 
            src={customImageUrl}
            alt={`${title} illustration`}
            className="h-18 w-18 mx-auto"
            onError={handleImageError}
          />
        ) : (
          <FallbackIcon className="h-18 w-18 text-muted-foreground mx-auto" />
        )}
      </div>
      
      <h3 className="text-lg font-semibold mb-2">
        {title}
      </h3>
      
      <p className="text-muted-foreground mb-4">
        {description}
      </p>
      
      {action && (
        <Button onClick={action.onClick} className="gap-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}