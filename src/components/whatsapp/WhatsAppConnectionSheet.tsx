import { useState, useEffect, useCallback } from 'react'
import { QrCode, Loader2, Wifi, X, Smartphone, ArrowRight, RefreshCw, Download } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig'
import { WhatsAppConnectionBadge } from './WhatsAppConnectionBadge'
import whatsappLogo from '@/assets/whatsapp-logo.png'

interface WhatsAppConnectionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WhatsAppConnectionSheet({ open, onOpenChange }: WhatsAppConnectionSheetProps) {
  const {
    sessionStatus,
    isSaving,
    startConnection,
    disconnect,
    updateSessionStatus,
    refreshQr,
    syncAll,
    connectedPhone,
    lastError,
    qrCodeData,
    qrExpiresAt,
    conversationCount,
  } = useWhatsAppConfig()

  const [isSyncing, setIsSyncing] = useState(false)

  const handleStartConnection = async () => {
    try {
      await startConnection()
    } catch {
      // Error handled by hook
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      onOpenChange(false)
    } catch {
      // Error handled by hook
    }
  }

  const handleCancel = async () => {
    if (sessionStatus === 'waiting_for_qr' || sessionStatus === 'connecting') {
      try {
        await disconnect()
      } catch {
        await updateSessionStatus('disconnected')
      }
    }
    onOpenChange(false)
  }

  const handleRefreshQr = async () => {
    try {
      await refreshQr()
    } catch {
      // Error handled by hook
    }
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    try {
      await syncAll()
    } catch {
      // Error handled by hook
    } finally {
      setIsSyncing(false)
    }
  }

  // Check if QR is expired
  const isQrExpired = qrExpiresAt ? new Date(qrExpiresAt) < new Date() : false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366]/10">
              <img src={whatsappLogo} alt="WhatsApp" className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-base">Connect WhatsApp</SheetTitle>
              <SheetDescription className="text-xs">
                Link your WhatsApp to sync conversations
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* State: Disconnected — show instructions */}
          {sessionStatus === 'disconnected' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground">How to connect</h4>
                <div className="space-y-3">
                  {[
                    { step: '1', icon: Smartphone, text: 'Open WhatsApp on your phone' },
                    { step: '2', icon: QrCode, text: 'Go to Settings → Linked Devices → Link a Device' },
                    { step: '3', icon: ArrowRight, text: 'Scan the QR code that appears here' },
                  ].map((item) => (
                    <div key={item.step} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {item.step}
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-sm text-foreground">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleStartConnection}
                disabled={isSaving}
                className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Generate QR Code
              </Button>
            </div>
          )}

          {/* State: Waiting for QR — show real QR code */}
          {sessionStatus === 'waiting_for_qr' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                {qrCodeData && !isQrExpired ? (
                  <div className="w-64 h-64 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden">
                    <img
                      src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                      alt="WhatsApp QR Code"
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center">
                    {isSaving ? (
                      <>
                        <Loader2 className="h-12 w-12 text-muted-foreground/40 mb-3 animate-spin" />
                        <p className="text-xs text-muted-foreground font-medium">Generating QR code…</p>
                      </>
                    ) : (
                      <>
                        <QrCode className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-xs text-muted-foreground font-medium">
                          {isQrExpired ? 'QR code expired' : 'Waiting for QR code…'}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRefreshQr}
                          disabled={isSaving}
                          className="mt-2 text-xs"
                        >
                          <RefreshCw className="h-3 w-3 mr-1.5" />
                          {isQrExpired ? 'Generate new QR' : 'Refresh'}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <WhatsAppConnectionBadge status="waiting_for_qr" size="md" />
                  {qrCodeData && !isQrExpired && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshQr}
                      disabled={isSaving}
                      className="h-6 text-[10px] text-muted-foreground"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Scan with WhatsApp:</strong> Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Point your camera at the QR code.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* State: Connecting */}
          {sessionStatus === 'connecting' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                <div className="h-16 w-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
                  <Loader2 className="h-8 w-8 text-[#25D366] animate-spin" />
                </div>
                <p className="text-sm font-medium text-foreground">Establishing connection…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This usually takes a few seconds.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* State: Connected */}
          {(sessionStatus === 'connected' || sessionStatus === 'syncing') && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-6">
                <div className="h-16 w-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
                  {sessionStatus === 'syncing' || isSyncing ? (
                    <Loader2 className="h-8 w-8 text-[#25D366] animate-spin" />
                  ) : (
                    <Wifi className="h-8 w-8 text-[#25D366]" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {sessionStatus === 'syncing' || isSyncing ? 'Syncing conversations…' : 'WhatsApp connected'}
                </p>
                {connectedPhone && (
                  <p className="text-xs font-mono text-muted-foreground mt-1">+{connectedPhone}</p>
                )}
                {conversationCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {conversationCount} conversation{conversationCount !== 1 ? 's' : ''} synced
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleSyncNow}
                  disabled={isSaving || isSyncing}
                  className="w-full"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isSyncing ? 'Syncing…' : 'Sync conversations now'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="w-full text-destructive hover:text-destructive"
                >
                  Disconnect WhatsApp
                </Button>
              </div>
            </div>
          )}

          {/* State: Error / Reconnect / Expired */}
          {(sessionStatus === 'error' || sessionStatus === 'reconnect_required' || sessionStatus === 'expired') && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-6">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <X className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {sessionStatus === 'expired' ? 'Session expired' : sessionStatus === 'reconnect_required' ? 'Reconnection needed' : 'Connection error'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 text-center max-w-[280px]">
                  {lastError || 'Your WhatsApp session needs to be re-established. Please reconnect.'}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleStartConnection}
                  disabled={isSaving}
                  className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Reconnect WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
