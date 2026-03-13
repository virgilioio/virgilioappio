import { useState } from 'react'
import {
  Phone,
  AlertCircle,
  Wifi,
  WifiOff,
  QrCode,
  Unplug,
  Loader2,
  RefreshCw,
  MessageSquare,
} from 'lucide-react'
import whatsappLogo from '@/assets/whatsapp-logo.png'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  useWhatsAppConfig,
  useWhatsAppSessionState,
} from '@/hooks/useWhatsAppConfig'
import { WhatsAppConnectionBadge } from '@/components/whatsapp/WhatsAppConnectionBadge'
import { WhatsAppConnectionSheet } from '@/components/whatsapp/WhatsAppConnectionSheet'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function WhatsAppIntegrationCard() {
  const {
    isConnected,
    sessionStatus,
    connectedPhone,
    isLoading,
    isSaving,
    isActive,
    toggle,
    connectedAt,
    lastSyncAt,
    lastError,
    conversationCount,
    disconnect,
  } = useWhatsAppConfig()

  const sessionState = useWhatsAppSessionState()
  const [showConnectionSheet, setShowConnectionSheet] = useState(false)

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle(enabled)
      toast.success(enabled ? 'WhatsApp sync enabled' : 'WhatsApp sync paused')
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

  if (isLoading || sessionState.isLoading) return null

  const statusConfig = getStatusConfig(sessionStatus)

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
                  Sync your WhatsApp conversations and manage them inside GoGio
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <WhatsAppConnectionBadge status={sessionStatus} size="md" />
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
          {/* Session status */}
          <div className={cn(
            'p-4 rounded-lg border',
            statusConfig.bgClass,
            statusConfig.borderClass
          )}>
            <div className="flex items-start gap-3">
              <statusConfig.icon className={cn('h-5 w-5 mt-0.5 shrink-0', statusConfig.iconClass)} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{sessionState.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sessionState.description}</p>
              </div>
            </div>
          </div>

          {/* Connected session info */}
          {isConnected && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Connected account
              </h4>
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[#25D366]" />
                    <span className="text-sm font-mono text-foreground">
                      {connectedPhone || 'WhatsApp account'}
                    </span>
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
                {/* Sync stats */}
                <div className="flex items-center gap-4 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {conversationCount} conversation{conversationCount !== 1 ? 's' : ''} synced
                    </span>
                  </div>
                  {lastSyncAt && (
                    <span className="text-[10px] text-muted-foreground">
                      Last sync: {new Date(lastSyncAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
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
            {(sessionStatus === 'disconnected' || sessionStatus === 'error') && (
              <Button
                onClick={() => setShowConnectionSheet(true)}
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Connect WhatsApp
              </Button>
            )}

            {(sessionStatus === 'reconnect_required' || sessionStatus === 'expired') && (
              <Button
                onClick={() => setShowConnectionSheet(true)}
                className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect WhatsApp
              </Button>
            )}

            {(sessionStatus === 'waiting_for_qr' || sessionStatus === 'connecting') && (
              <Button
                onClick={() => setShowConnectionSheet(true)}
                variant="outline"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Continue setup
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
          </div>

          {/* How it works — only when disconnected */}
          {sessionStatus === 'disconnected' && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How it works</h4>
              <div className="grid gap-2">
                {[
                  { step: '1', text: 'Scan a QR code to link your WhatsApp' },
                  { step: '2', text: 'Conversations sync automatically into GoGio' },
                  { step: '3', text: 'Map conversations to candidates in your pipeline' },
                  { step: '4', text: 'Manage all candidate communication from one place' },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3 p-2 rounded-md bg-muted/20">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
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

      {/* Connection sheet */}
      <WhatsAppConnectionSheet
        open={showConnectionSheet}
        onOpenChange={setShowConnectionSheet}
      />
    </div>
  )
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'connected':
    case 'syncing':
      return {
        icon: Wifi,
        bgClass: 'bg-[#25D366]/5',
        borderClass: 'border-[#25D366]/20',
        iconClass: 'text-[#25D366]',
      }
    case 'waiting_for_qr':
    case 'connecting':
      return {
        icon: QrCode,
        bgClass: 'bg-amber-50 dark:bg-amber-950/20',
        borderClass: 'border-amber-200 dark:border-amber-800/30',
        iconClass: 'text-amber-600 dark:text-amber-400',
      }
    case 'reconnect_required':
      return {
        icon: RefreshCw,
        bgClass: 'bg-amber-50 dark:bg-amber-950/20',
        borderClass: 'border-amber-200 dark:border-amber-800/30',
        iconClass: 'text-amber-600 dark:text-amber-400',
      }
    case 'expired':
    case 'error':
      return {
        icon: AlertCircle,
        bgClass: 'bg-destructive/5',
        borderClass: 'border-destructive/20',
        iconClass: 'text-destructive',
      }
    default: // disconnected
      return {
        icon: WifiOff,
        bgClass: 'bg-muted/20',
        borderClass: 'border-border',
        iconClass: 'text-muted-foreground',
      }
  }
}
