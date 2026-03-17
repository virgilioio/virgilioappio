import { useState, useEffect } from 'react'
import { GioLoader } from '@/components/ui/GioLoader'

const THINKING_MESSAGES = [
  "Analyzing your prompt",
  "Understanding job context",
  "Identifying core skills",
  "Mapping geographic requirements",
  "Matching candidates",
  "Evaluating experience levels",
  "Finding your people"
]

export function GioThinkingHeader() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in">
      <GioLoader size="md" />

      {/* Simple Shimmer Beam Bar - Solid Color */}
      <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full w-1/4 rounded-full bg-virgilio-purple animate-shimmer-beam"
        />
      </div>

      {/* Status Message - Bigger, Bolder, Purple Dots */}
      <div className="h-8 flex items-center justify-center">
        <p 
          key={messageIndex}
          className="text-lg font-poppins font-bold text-virgilio-text animate-fade-in"
          style={{ letterSpacing: '-0.06em' }}
        >
          {THINKING_MESSAGES[messageIndex]}
          <span className="text-virgilio-purple">...</span>
        </p>
      </div>
    </div>
  )
}
