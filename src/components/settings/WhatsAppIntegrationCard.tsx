import { useState } from 'react'
import {
  Check,
  Phone,
  MessageSquare,
  AlertCircle,
  Wifi,
  WifiOff,
  QrCode,
  Unplug,
} from 'lucide-react'
import whatsappLogo from '@/assets/whatsapp-logo.png'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  useWhatsAppConfig,
  useWhatsAppConnectionState,
} from '@/hooks/useWhatsAppConfig'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function WhatsAppIntegrationCard() {
  const {
    isConnected,
    connectedPhone,
    isLoading,
    isSaving,
    isActive,
    toggle,
    connectedAt,
    lastError,
    connectionStatus,
    disconnect,
  } = useWhatsAppConfig()

  const connectionState = useWhatsAppConnectionState()

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle(enabled)
      toast.success(enabled ? 'WhatsApp sync enabled' : 'WhatsApp sync disabled')
    } catch {
      toast.error('Failed to update WhatsApp status')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast.success('WhatsApp disconnected')
    } catch {
      toast.error('Failed to disconnect WhatsApp')
    }
  }

  if (isLoading || connectionState.isLoading) return null

  const statusConfig = getStatusConfig(connectionStatus)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg">
                <img src={whatsappLogo} alt="WhatsApp" className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
                <CardDescription>
                  Connect your WhatsApp to sync conversations with candidates
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn('text-[11px] font-medium gap-1', statusConfig.badgeClass)}
              >
                <statusConfig.icon className="h-3 w-3" />
                {connectionState.label}
              </Badge>
              {isConnected && (
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
          {/* Connection status */}
          <div className={cn(
            'p-4 rounded-lg border',
            statusConfig.bgClass,
            statusConfig.borderClass
          )}>
            <div className="flex items-start gap-3">
              <statusConfig.icon className={cn('h-5 w-5 mt-0.5 shrink-0', statusConfig.iconClass)} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{connectionState.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{connectionState.description}</p>
              </div>
            </div>
          </div>

          {/* Connected phone info */}
          {isConnected && connectedPhone && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Connected account
              </h4>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[#25D366]" />
                  <span className="text-sm font-mono text-foreground">{connectedPhone}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {isActive ? 'Syncing' : 'Paused'}
                  </Badge>
                </div>
                {connectedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Since {new Date(connectedAt).toLocaleDateString()}
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
                <p className="text-xs font-medium text-destructive">Connection error</p>
                <p className="text-xs text-destructive/80 mt-0.5">{lastError}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!isConnected && (
              <Button
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                disabled
              >
                <QrCode className="h-4 w-4 mr-2" />
                Connect WhatsApp
                <Badge variant="secondary" className="ml-2 text-[9px] bg-white/20 text-white border-0">
                  Coming soon
                </Badge>
              </Button>
            )}

            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isSaving}
                className="text-muted-foreground"
              >
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            )}

            {connectionStatus === 'expired' && (
              <Button
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                disabled
              >
                <QrCode className="h-4 w-4 mr-2" />
                Reconnect
                <Badge variant="secondary" className="ml-2 text-[9px] bg-white/20 text-white border-0">
                  Coming soon
                </Badge>
              </Button>
            )}
          </div>

          {/* How it works */}
          {!isConnected && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How it works</h4>
              <div className="grid gap-2">
                {[
                  { step: '1', text: 'Scan a QR code to connect your WhatsApp' },
                  { step: '2', text: 'Conversations sync automatically into GoGio' },
                  { step: '3', text: 'Map conversations to candidates in your pipeline' },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3 p-2 rounded-md bg-muted/20">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {item.step}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'connected':
      return {
        icon: Wifi,
        badgeClass: 'border-[#25D366]/30 text-[#25D366]',
        bgClass: 'bg-[#25D366]/5',
        borderClass: 'border-[#25D366]/20',
        iconClass: 'text-[#25D366]',
      }
    case 'connecting':
      return {
        icon: QrCode,
        badgeClass: 'border-amber-500/30 text-amber-600',
        bgClass: 'bg-amber-50 dark:bg-amber-950/20',
        borderClass: 'border-amber-200 dark:border-amber-800/30',
        iconClass: 'text-amber-600',
      }
    case 'expired':
      return {
        icon: AlertCircle,
        badgeClass: 'border-destructive/30 text-destructive',
        bgClass: 'bg-destructive/5',
        borderClass: 'border-destructive/20',
        iconClass: 'text-destructive',
      }
    default: // disconnected
      return {
        icon: WifiOff,
        badgeClass: 'border-muted-foreground/30 text-muted-foreground',
        bgClass: 'bg-muted/20',
        borderClass: 'border-border',
        iconClass: 'text-muted-foreground',
      }
  }
}
