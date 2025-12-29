import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import gioAvatar from '@/assets/gio-avatar.png'
import gioFaceYellow from '@/assets/gio-face-yellow.png'
import gioFaceEmpty from '@/assets/gio-face-empty.png'
import gioFacePurple from '@/assets/gio-face-purple.png'
import gioFacePink from '@/assets/gio-face-pink.png'
import gioFaceGreen from '@/assets/gio-face-green.png'

const GIO_AVATARS = [gioAvatar, gioFaceYellow, gioFacePurple, gioFacePink, gioFaceGreen]

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
  const [isMirrored, setIsMirrored] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)

  // Handle flip animation and avatar swap
  const triggerFlip = useCallback(() => {
    setIsFlipping(true)
    
    // Swap avatar at 35% (when edge-on at 90deg, ~175ms into 500ms animation)
    setTimeout(() => {
      setAvatarIndex((prev) => (prev + 1) % GIO_AVATARS.length)
    }, 175)
    
    // Reset flip state and toggle mirrored state after animation completes
    setTimeout(() => {
      setIsFlipping(false)
      setIsMirrored((prev) => !prev)
    }, 500)
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
            "w-full h-full rounded-full object-cover will-change-transform",
            isFlipping && (isMirrored ? "animate-coin-flip-2d-reverse" : "animate-coin-flip-2d")
          )}
          style={{ transform: isMirrored ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
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
          style={{ letterSpacing: '-0.06em' }}
        >
          {THINKING_MESSAGES[messageIndex]}
          <span className="text-virgilio-purple">...</span>
        </p>
      </div>
    </div>
  )
}
