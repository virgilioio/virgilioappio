import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import gioAvatar from '@/assets/gio-avatar.png'
import gioFaceYellow from '@/assets/gio-face-yellow.png'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

const GIO_AVATARS = [gioAvatar, gioFaceYellow, gioFaceEmpty]

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
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)

  // Handle flip animation and avatar swap
  const triggerFlip = useCallback(() => {
    setIsFlipping(true)
    
    // Swap avatar at 75% (when edge-on at 270deg, ~525ms into 700ms animation)
    setTimeout(() => {
      setAvatarIndex((prev) => (prev + 1) % GIO_AVATARS.length)
    }, 525)
    
    // Reset flip state after animation completes
    setTimeout(() => {
      setIsFlipping(false)
    }, 700)
  }, [])

  // Trigger flip every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      triggerFlip()
    }, 2000)
    return () => clearInterval(interval)
  }, [triggerFlip])

  // Cycle through messages every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in">
      {/* Simple 2D Flipping Avatar */}
      <div className="relative w-20 h-20">
        <img 
          src={GIO_AVATARS[avatarIndex]} 
          alt="Gio"
          className={cn(
            "w-full h-full rounded-full object-cover shadow-lg will-change-transform",
            isFlipping && "animate-coin-flip-2d"
          )}
        />
      </div>

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
        >
          {THINKING_MESSAGES[messageIndex]}
          <span className="text-virgilio-purple">...</span>
        </p>
      </div>
    </div>
  )
}
