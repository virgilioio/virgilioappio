import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import whatsappLogo from '@/assets/whatsapp-logo.png'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig'
import { toast } from 'sonner'

const E164_REGEX = /^\+[1-9]\d{1,14}$/

export function WhatsAppIntegrationCard() {
  const { isConfigured, fromNumber, isLoading, isSaving, isActive, saveNumber, toggle } = useWhatsAppConfig()
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (fromNumber) {
      // Strip whatsapp: prefix for display
      setNumber(fromNumber.replace('whatsapp:', ''))
    }
  }, [fromNumber])

  const handleSave = async () => {
    const cleanNumber = number.trim()
    if (!E164_REGEX.test(cleanNumber)) {
      setError('Enter a valid phone number in E.164 format (e.g. +14155238886)')
      return
    }
    setError('')
    try {
      await saveNumber(cleanNumber)
      toast.success('WhatsApp number saved')
    } catch {
      toast.error('Failed to save WhatsApp number')
    }
  }

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle(enabled)
      toast.success(enabled ? 'WhatsApp enabled' : 'WhatsApp disabled')
    } catch {
      toast.error('Failed to update WhatsApp status')
    }
  }

  if (isLoading) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366]/10">
              <MessageSquare className="h-5 w-5 text-[#25D366]" />
            </div>
            <div>
              <CardTitle className="text-base">WhatsApp Business</CardTitle>
              <CardDescription>Send WhatsApp messages to candidates via Twilio</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConfigured && (
              <Badge variant="outline" className="border-[#25D366]/30 text-[#25D366]">
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={isSaving || !fromNumber}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatsapp-number">WhatsApp-enabled Twilio Number</Label>
          <div className="flex gap-2">
            <Input
              id="whatsapp-number"
              placeholder="+14155238886"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value)
                setError('')
              }}
              className="max-w-xs"
            />
            <Button onClick={handleSave} disabled={isSaving || !number.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Enter your Twilio WhatsApp-enabled number in E.164 format. Get one from your{' '}
            <a
              href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Twilio console
            </a>.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
