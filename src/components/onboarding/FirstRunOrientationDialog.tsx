import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import gioAvatar from '@/assets/gio-avatar.png'

interface FirstRunOrientationDialogProps {
  open: boolean
  onComplete: () => void
}

const steps = [
  {
    title: 'Welcome to GoGio',
    description: "I'm Gio, your AI sourcing partner. I'll help you find the right people for your roles — quickly and calmly.",
  },
  {
    title: 'What GoGio does',
    description: "Tell me about the role you're hiring for, and I'll search millions of profiles to find people worth talking to.",
  },
  {
    title: 'What happens next',
    description: "Describe the role in a few words, and I'll show you candidates that match. You can refine from there.",
  },
]

export function FirstRunOrientationDialog({ open, onComplete }: FirstRunOrientationDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const handleClose = () => {
    sessionStorage.removeItem('virgilio_first_run')
    onComplete()
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handleSkip = () => {
    handleClose()
  }

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={gioAvatar} 
              alt="Gio AI Assistant"
              className="h-16 w-16 rounded-full"
            />
          </div>
          <DialogTitle className="text-xl font-poppins font-bold" style={{ letterSpacing: '-0.03em' }}>
            {step.title}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 my-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                index === currentStep ? 'bg-virgilio-purple' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleNext} className="w-full">
            {isLastStep ? "Let's go" : 'Continue'}
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
            Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
