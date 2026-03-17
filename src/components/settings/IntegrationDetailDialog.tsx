import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CATEGORY_LABELS, type IntegrationCategory } from './integrationRegistry'
import { Check, Download, Trash2, Settings, ChevronLeft, ChevronRight } from 'lucide-react'

interface IntegrationDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  description: string
  detailContent?: React.ReactNode
  category: IntegrationCategory
  logo: React.ReactNode
  images?: string[]
  isConnected: boolean
  onInstall: () => void
  onUninstall: () => void
  onConfigure: () => void
  isInstalling?: boolean
}

function ImageCarousel({ images, logo }: { images?: string[]; logo: React.ReactNode }) {
  const [current, setCurrent] = useState(0)

  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60 border border-border">
          {logo}
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="relative flex-1 overflow-hidden rounded-xl bg-muted/20">
        <img
          src={images[current]}
          alt={`Screenshot ${current + 1}`}
          className="w-full h-full object-cover rounded-xl"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrent((p) => (p + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-3">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current
                  ? 'w-6 bg-virgilio-purple'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function IntegrationDetailDialog({
  open,
  onOpenChange,
  name,
  description,
  detailContent,
  category,
  logo,
  images,
  isConnected,
  onInstall,
  onUninstall,
  onConfigure,
  isInstalling,
}: IntegrationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 border border-border">
              {logo}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-poppins font-semibold">
                {name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </Badge>
                {isConnected ? (
                  <Badge variant="outline" className="border-virgilio-success/30 text-virgilio-success gap-1 text-[11px] font-medium">
                    <Check className="h-3 w-3" />
                    Installed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-border text-muted-foreground text-[11px] font-medium">
                    Not Installed
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body: 3:3:1 ratio → 43% carousel | 43% content | 14% actions */}
        <div className="flex flex-col sm:flex-row h-[441px]">
          {/* Left — Carousel (4 parts) */}
          <div className="sm:w-[50%] p-5">
            <ImageCarousel images={images} logo={logo} />
          </div>

          {/* Center — Description (3 parts) */}
          <div className="sm:w-[37.5%] p-5 sm:pl-0 overflow-y-auto">
            {detailContent ? (
              <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
                {detailContent}
              </div>
            ) : (
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            )}
          </div>

          {/* Right — Actions (1 part) */}
          <div className="sm:w-[12.5%] p-4 sm:border-l border-border flex flex-col items-center justify-start gap-2">
            {isConnected ? (
              <>
                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-virgilio-rejected hover:bg-virgilio-rejected/90 text-white border-0 text-xs"
                  onClick={() => {
                    onUninstall()
                    onOpenChange(false)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Uninstall
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-virgilio-purple text-virgilio-purple hover:bg-virgilio-purple/10 text-xs"
                  onClick={() => {
                    onOpenChange(false)
                    onConfigure()
                  }}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="w-full gap-1.5 bg-virgilio-purple hover:bg-virgilio-purple/90 text-white border-0 text-xs"
                onClick={() => {
                  onInstall()
                  onOpenChange(false)
                }}
                disabled={isInstalling}
              >
                <Download className="h-3.5 w-3.5" />
                {isInstalling ? 'Installing...' : 'Install'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
