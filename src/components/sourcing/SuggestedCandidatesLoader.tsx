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
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 85) return prev + 2.5
        if (prev < 99) return prev + 0.15
        return prev
      })
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in">
      <GioLoader size="md" />

      <div className="w-64 h-6 rounded-full bg-muted border border-border/50 overflow-hidden relative">
        <div 
          className="h-full bg-gradient-to-r from-[#d7c5fb] to-[#6F3FF5] shadow-[0_0_12px_rgba(215,197,251,0.4)] transition-all duration-150 ease-out flex items-center justify-end pr-2"
          style={{ width: `${progress}%` }}
        >
          {progress > 15 && (
            <span className="text-[10px] font-bold text-white leading-none whitespace-nowrap">
              {Math.round(progress)}%
            </span>
          )}
        </div>
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
