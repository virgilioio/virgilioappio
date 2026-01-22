import { useState, useEffect } from 'react'

interface ParsingAnimationProps {
  isActive: boolean
  mode?: 'core' | 'full'
  onComplete?: () => void
}

const coreParsingSteps = [
  "Analyzing Resume...",
  "Extracting Contact Info...",
  "Detecting Location...",
  "Almost done..."
]

const fullParsingSteps = [
  "Analyzing Resume...",
  "Creating Profile Summary...", 
  "Extracting Important Data...",
  "Generating Skills..."
]

export function ParsingAnimation({ isActive, mode = 'full', onComplete }: ParsingAnimationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [completed, setCompleted] = useState(false)

  const parsingSteps = mode === 'core' ? coreParsingSteps : fullParsingSteps

  useEffect(() => {
    if (!isActive) {
      // Reset when not active
      setCurrentStepIndex(0)
      setCurrentText('')
      setIsTyping(true)
      setCompleted(false)
      return
    }

    const currentStep = parsingSteps[currentStepIndex]
    
    if (isTyping && currentText.length < currentStep.length) {
      // Typing characters - faster for core mode
      const timeout = setTimeout(() => {
        setCurrentText(currentStep.slice(0, currentText.length + 1))
      }, mode === 'core' ? 40 : 50)
      return () => clearTimeout(timeout)
    } else if (isTyping && currentText.length === currentStep.length) {
      // Finished typing this step - pause before next
      const pauseTimeout = setTimeout(() => {
        if (currentStepIndex < parsingSteps.length - 1) {
          // Move to next step
          setCurrentText('')
          setIsTyping(true)
          setCurrentStepIndex(prev => prev + 1)
        } else {
          // Completed all steps
          setCompleted(true)
          onComplete?.()
        }
      }, mode === 'core' ? 600 : 800)
      
      return () => clearTimeout(pauseTimeout)
    }
  }, [currentText, currentStepIndex, isTyping, isActive, onComplete, mode, parsingSteps])

  if (!isActive) {
    return null
  }

  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-pastel-purple-foreground rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-pastel-purple-foreground rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-pastel-purple-foreground rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-text-secondary font-medium min-w-[180px] text-left">
        {currentText}
        {!completed && <span className="animate-pulse">|</span>}
      </span>
    </div>
  )
}
