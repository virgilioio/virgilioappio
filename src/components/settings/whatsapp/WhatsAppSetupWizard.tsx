import { useState } from 'react'
import { Check, ChevronRight, Loader2, Phone, Shield, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WhatsAppSetupWizardProps {
  onComplete?: () => void
}

type WizardStep = 'welcome' | 'provision' | 'complete'

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: 'welcome', label: 'Overview', icon: MessageSquare },
  { id: 'provision', label: 'Get number', icon: Phone },
  { id: 'complete', label: 'Ready', icon: Check },
]

export function WhatsAppSetupWizard({ onComplete }: WhatsAppSetupWizardProps) {
  const { isProvisioned, whatsappNumber, provisionNumber, saveNumber, isSaving } = useWhatsAppConfig()
  const [currentStep, setCurrentStep] = useState<WizardStep>(isProvisioned ? 'complete' : 'welcome')
  const [manualNumber, setManualNumber] = useState('')
  const [showManual, setShowManual] = useState(false)

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  const handleProvision = async () => {
    try {
      await provisionNumber.mutateAsync('US')
      toast.success('WhatsApp number provisioned successfully')
      setCurrentStep('complete')
    } catch (error: any) {
      toast.error(error.message || 'Failed to provision number')
    }
  }

  const handleSaveManual = async () => {
    const cleaned = manualNumber.replace(/[^\d+]/g, '')
    if (!cleaned) return
    try {
      await saveNumber(cleaned.startsWith('+') ? cleaned : `+${cleaned}`)
      toast.success('WhatsApp sender number saved')
      setShowManual(false)
      setManualNumber('')
      setCurrentStep('complete')
    } catch {
      toast.error('Failed to save number')
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex
          const isCurrent = i === currentIndex
          const StepIcon = step.icon
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                  isCompleted && 'bg-[#25D366]/10 text-[#25D366]',
                  isCurrent && 'bg-primary/10 text-primary',
                  !isCompleted && !isCurrent && 'text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <StepIcon className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {currentStep === 'welcome' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Set up workspace WhatsApp</h3>
              <p className="text-sm text-muted-foreground mt-1">
                GoGio will set up a dedicated WhatsApp number for your workspace so you can message candidates directly.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Dedicated number</p>
                  <p className="text-xs text-muted-foreground">Your workspace gets its own WhatsApp Business number, managed by GoGio.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Meta-approved templates</p>
                  <p className="text-xs text-muted-foreground">First-contact messages use pre-approved templates that comply with WhatsApp policies.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Seamless messaging</p>
                  <p className="text-xs text-muted-foreground">Once a candidate replies, you can message freely for 24 hours.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setCurrentStep('provision')} className="bg-[#25D366] hover:bg-[#25D366]/90 text-white">
                Get started
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'provision' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Provision your WhatsApp number</h3>
              <p className="text-sm text-muted-foreground mt-1">
                GoGio will provision a dedicated phone number for your workspace's WhatsApp messaging.
              </p>
            </div>

            {isProvisioned ? (
              <div className="p-4 rounded-lg bg-[#25D366]/5 border border-[#25D366]/20">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-[#25D366]" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Number provisioned</p>
                    <p className="text-sm font-mono text-muted-foreground">{whatsappNumber}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={handleProvision}
                  disabled={provisionNumber.isPending}
                  className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                >
                  {provisionNumber.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4 mr-2" />
                      Provision workspace number
                    </>
                  )}
                </Button>

                {provisionNumber.isError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive">
                      {(provisionNumber.error as Error)?.message || 'Failed to provision number. Please try again.'}
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => setShowManual(!showManual)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    {showManual ? 'Hide manual setup' : 'I already have a WhatsApp number'}
                  </button>
                </div>

                {showManual && (
                  <div className="p-4 rounded-lg border border-border space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Enter an existing Twilio WhatsApp Sender number. This is for advanced users who manage their own Twilio account.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="+1 234 567 8900"
                        value={manualNumber}
                        onChange={(e) => setManualNumber(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSaveManual}
                        disabled={!manualNumber.trim() || isSaving}
                        size="sm"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Must be registered as an active WhatsApp Sender in Twilio.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep('welcome')}>
                Back
              </Button>
              {isProvisioned && (
                <Button onClick={() => setCurrentStep('complete')} size="sm">
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {currentStep === 'complete' && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-[#25D366]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Workspace WhatsApp is set up</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your workspace has a dedicated WhatsApp number. You can now start messaging candidates using pre-approved templates.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="h-2 w-2 rounded-full bg-[#25D366]" />
              <span className="text-sm font-mono">{whatsappNumber}</span>
              <Badge variant="outline" className="border-[#25D366]/30 text-[#25D366] text-[10px]">Active</Badge>
            </div>
            <Button
              onClick={onComplete}
              className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
            >
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
