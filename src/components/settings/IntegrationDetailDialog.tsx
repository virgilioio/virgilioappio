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
import { Check, Download, Trash2, Settings } from 'lucide-react'

interface IntegrationDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  description: string
  category: IntegrationCategory
  logo: React.ReactNode
  isConnected: boolean
  onInstall: () => void
  onUninstall: () => void
  onConfigure: () => void
  isInstalling?: boolean
}

export function IntegrationDetailDialog({
  open,
  onOpenChange,
  name,
  description,
  category,
  logo,
  isConnected,
  onInstall,
  onUninstall,
  onConfigure,
  isInstalling,
}: IntegrationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 border border-border">
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
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 gap-1 text-[11px] font-medium">
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

        <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-2">
          {description}
        </DialogDescription>

        <div className="flex items-center gap-2 pt-4">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onUninstall()
                  onOpenChange(false)
                }}
              >
                <Trash2 className="h-4 w-4" />
                Uninstall
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => {
                  onOpenChange(false)
                  onConfigure()
                }}
              >
                <Settings className="h-4 w-4" />
                Configure
              </Button>
            </>
          ) : (
            <Button
              className="w-full gap-2"
              onClick={() => {
                onInstall()
                onOpenChange(false)
              }}
              disabled={isInstalling}
            >
              <Download className="h-4 w-4" />
              {isInstalling ? 'Installing...' : 'Install'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
