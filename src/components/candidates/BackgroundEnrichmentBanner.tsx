import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BackgroundEnrichmentBannerProps {
  isVisible: boolean
  onDismiss: () => void
}

export function BackgroundEnrichmentBanner({ isVisible, onDismiss }: BackgroundEnrichmentBannerProps) {
  if (!isVisible) return null
  
  return (
    <div className="bg-pastel-blue/20 border border-pastel-blue/40 rounded-lg p-3 flex items-center gap-3 animate-fade-in">
      <div className="flex-shrink-0">
        <Sparkles className="h-5 w-5 text-pastel-blue-foreground animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">AI enrichment ready</p>
        <p className="text-xs text-text-secondary">
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
  )
}
