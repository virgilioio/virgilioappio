import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import gioAiBannerIcon from '@/assets/gio-ai-banner-icon.png'

interface BackgroundEnrichmentBannerProps {
  isVisible: boolean
  onDismiss: () => void
}

export function BackgroundEnrichmentBanner({ isVisible, onDismiss }: BackgroundEnrichmentBannerProps) {
  if (!isVisible) return null
  
  return (
    <div className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 transition-colors animate-fade-in">
      <div className="p-3 flex items-start gap-3">
        <img src={gioAiBannerIcon} alt="Gio" className="h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">AI enrichment ready</p>
          <p className="text-xs text-muted-foreground">
            Full profile summary &amp; skills will be generated after you save.
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDismiss}
          className="flex-shrink-0 h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
