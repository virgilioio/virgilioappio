import { useState, useEffect } from 'react'
import gioAvatar from '@/assets/gio-avatar.png'
import gioFaceYellow from '@/assets/gio-face-yellow.png'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

const THINKING_MESSAGES = [
  "Analyzing your prompt...",
  "Understanding job context...",
  "Identifying core skills...",
  "Mapping geographic requirements...",
  "Matching candidates to your search...",
  "Evaluating experience levels...",
  "Finding your people..."
]

export function GioThinkingHeader() {
  const [messageIndex, setMessageIndex] = useState(0)

  // Cycle through messages every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
      {/* Coin Flip Avatars - 3 with staggered animations */}
      <div className="flex gap-4 items-center justify-center" style={{ perspective: '1000px' }}>
        <div className="animate-coin-flip opacity-0" style={{ animationDelay: '0s' }}>
          <img 
            src={gioFaceEmpty} 
            alt="Gio thinking"
            className="h-12 w-12 rounded-full shadow-md"
          />
        </div>
        <div className="animate-coin-flip opacity-0" style={{ animationDelay: '0.15s' }}>
          <img 
            src={gioAvatar} 
            alt="Gio thinking"
            className="h-16 w-16 rounded-full shadow-lg"
          />
        </div>
        <div className="animate-coin-flip opacity-0" style={{ animationDelay: '0.3s' }}>
          <img 
            src={gioFaceYellow} 
            alt="Gio thinking"
            className="h-12 w-12 rounded-full shadow-md"
          />
        </div>
      </div>

      {/* Progress Beam Bar */}
      <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full w-1/3 rounded-full animate-shimmer-beam"
          style={{
            background: 'linear-gradient(90deg, transparent, #6F3FF5, #d7c5fb, #6F3FF5, transparent)'
          }}
        />
      </div>

      {/* Status Message with fade transition */}
      <div className="h-6 flex items-center justify-center">
        <p 
          key={messageIndex}
          className="text-sm text-muted-foreground animate-fade-in"
        >
          {THINKING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}
