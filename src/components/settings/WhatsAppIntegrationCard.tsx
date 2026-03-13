import { useState } from 'react'
import {
  Check,
  Phone,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
} from 'lucide-react'
import whatsappLogo from '@/assets/whatsapp-logo.png'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  useWhatsAppConfig,
  useWhatsAppSetupStatus,
} from '@/hooks/useWhatsAppConfig'
import { WhatsAppSetupWizard } from './whatsapp/WhatsAppSetupWizard'
import { WhatsAppTemplateLibrary } from './whatsapp/WhatsAppTemplateLibrary'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function WhatsAppIntegrationCard() {
  const {
    isProvisioned,
    whatsappNumber,
    isLoading,
    isSaving,
    isActive,
    toggle,
    provisionedAt,
    lastError,
  } = useWhatsAppConfig()

  const setupState = useWhatsAppSetupStatus()
  const [showWizard, setShowWizard] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle(enabled)
      toast.success(enabled ? 'WhatsApp messaging enabled' : 'WhatsApp messaging disabled')
    } catch {
      toast.error('Failed to update WhatsApp status')
    }
  }

  if (isLoading || setupState.isLoading) return null

  const statusConfig = getStatusConfig(setupState.status)

  return (
    <div className="space-y-6">
      {/* Status Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg">
                <img src={whatsappLogo} alt="WhatsApp" className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-base">Workspace WhatsApp</CardTitle>
                <CardDescription>
                  Your workspace's dedicated WhatsApp messaging channel
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn('text-[11px] font-medium gap-1', statusConfig.badgeClass)}
              >
                <statusConfig.icon className="h-3 w-3" />
                {setupState.label}
              </Badge>
              {isProvisioned && (
                <Switch
                  checked={isActive}
                  onCheckedChange={handleToggle}
                  disabled={isSaving}
                />
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Setup status overview */}
          <div className={cn(
            'p-4 rounded-lg border',
            statusConfig.bgClass,
            statusConfig.borderClass
          )}>
            <div className="flex items-start gap-3">
              <statusConfig.icon className={cn('h-5 w-5 mt-0.5 shrink-0', statusConfig.iconClass)} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{setupState.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{setupState.description}</p>
              </div>
            </div>
          </div>

          {/* Sender info - only show when provisioned */}
          {isProvisioned && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Workspace sender
              </h4>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    isActive ? 'bg-[#25D366]' : 'bg-muted-foreground'
                  )} />
                  <span className="text-sm font-mono text-foreground">{whatsappNumber}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {provisionedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Since {new Date(provisionedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error display */}
          {lastError && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-destructive">Last error</p>
                <p className="text-xs text-destructive/80 mt-0.5">{lastError}</p>
              </div>
            </div>
          )}

          {/* Primary actions */}
          <div className="flex flex-wrap gap-2">
            {!isProvisioned && (
              <Button
                onClick={() => setShowWizard(true)}
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                <Phone className="h-4 w-4 mr-2" />
                Set up workspace WhatsApp
              </Button>
            )}

            {isProvisioned && !showWizard && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {showTemplates ? 'Hide' : 'Manage'} Templates
                  {showTemplates ? (
                    <ChevronUp className="h-3.5 w-3.5 ml-1" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowWizard(true)}
                  className="text-muted-foreground"
                >
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Setup details
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Wizard - shown inline when triggered */}
      {showWizard && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">WhatsApp Setup</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWizard(false)}
                className="h-7 text-xs"
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <WhatsAppSetupWizard onComplete={() => setShowWizard(false)} />
          </CardContent>
        </Card>
      )}

      {/* Template Library - shown inline when triggered */}
      {showTemplates && isProvisioned && (
        <Card>
          <CardContent className="pt-6">
            <WhatsAppTemplateLibrary />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'active':
      return {
        icon: Check,
        badgeClass: 'border-[#25D366]/30 text-[#25D366]',
        bgClass: 'bg-[#25D366]/5',
        borderClass: 'border-[#25D366]/20',
        iconClass: 'text-[#25D366]',
      }
    case 'error':
      return {
        icon: AlertCircle,
        badgeClass: 'border-destructive/30 text-destructive',
        bgClass: 'bg-destructive/5',
        borderClass: 'border-destructive/20',
        iconClass: 'text-destructive',
      }
    default: // not_started
      return {
        icon: MessageSquare,
        badgeClass: 'border-muted-foreground/30 text-muted-foreground',
        bgClass: 'bg-muted/20',
        borderClass: 'border-border',
        iconClass: 'text-muted-foreground',
      }
  }
}
