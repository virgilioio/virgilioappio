import { useState, useEffect } from 'react'
import { GioLoader } from '@/components/ui/GioLoader'

const THINKING_MESSAGES = [
  "Scanning your talent pool",
  "Analyzing job requirements",
  "Matching skills & experience",
  "Evaluating candidate fit",
  "Ranking best matches",
  "Finding your people"
]

export function SuggestedCandidatesLoader() {
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

      <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full w-1/4 rounded-full bg-primary animate-shimmer-beam"
        />
      </div>

      <div className="h-8 flex items-center justify-center">
        <p 
          key={messageIndex}
          className="text-lg font-poppins font-bold text-foreground animate-fade-in"
          style={{ letterSpacing: '-0.06em' }}
        >
          {THINKING_MESSAGES[messageIndex]}
          <span className="text-primary">...</span>
        </p>
      </div>
    </div>
  )
}
