import { useState, useEffect } from 'react'

interface ParsingAnimationProps {
  isActive: boolean
  mode?: 'quick' | 'full'
  onComplete?: () => void
}

const quickParsingSteps = [
  "Reading Resume",
  "Extracting Contact Info",
  "Done!"
]

const fullParsingSteps = [
  "Analyzing Resume",
  "Creating Profile Summary", 
  "Extracting Important Data",
  "Extracting Skills"
]

export function ParsingAnimation({ isActive, mode = 'full', onComplete }: ParsingAnimationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [completed, setCompleted] = useState(false)

  const parsingSteps = mode === 'quick' ? quickParsingSteps : fullParsingSteps

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
      // Typing characters
      const timeout = setTimeout(() => {
        setCurrentText(currentStep.slice(0, currentText.length + 1))
      }, mode === 'quick' ? 30 : 50) // Faster typing for quick mode
      return () => clearTimeout(timeout)
    } else if (isTyping && currentText.length === currentStep.length) {
      // Finished typing this step
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
      }, mode === 'quick' ? 400 : 800) // Shorter pause for quick mode
      
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
      <span className="text-sm text-text-secondary font-medium min-w-[140px] text-left">
        {currentText}
        {!completed && <span className="animate-pulse">|</span>}
      </span>
    </div>
  )
}