import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import gioAvatar from '@/assets/gio-avatar.png'
import gioFaceYellow from '@/assets/gio-face-yellow.png'
import gioFaceEmpty from '@/assets/gio-face-empty.png'
import gioFacePurple from '@/assets/gio-face-purple.png'
import gioFacePink from '@/assets/gio-face-pink.png'
import gioFaceGreen from '@/assets/gio-face-green.png'
import { useEffect } from 'react'

export const GIO_AVATARS = [gioAvatar, gioFaceYellow, gioFacePurple, gioFacePink, gioFaceGreen]

interface GioLoaderProps {
  size?: 'sm' | 'md'
  message?: string
  className?: string
}

export function GioLoader({ size = 'md', message, className }: GioLoaderProps) {
  const [frontIndex, setFrontIndex] = useState(0)
  const [backIndex, setBackIndex] = useState(1)
  const [isFlipping, setIsFlipping] = useState(false)
  // false = front showing (0deg), true = back showing (180deg)
  const [showingBack, setShowingBack] = useState(false)

  const triggerFlip = useCallback(() => {
    setIsFlipping(true)
  }, [])

  useEffect(() => {
    const interval = setInterval(triggerFlip, 1200)
    return () => clearInterval(interval)
  }, [triggerFlip])

  const handleAnimationEnd = useCallback(() => {
    setIsFlipping(false)
    setShowingBack((prev) => {
      const nowShowingBack = !prev
      // Queue the next avatar on the face that's now hidden
      if (nowShowingBack) {
        // Back is now visible, front is hidden → update front to next avatar
        setFrontIndex((prev) => (prev + 2) % GIO_AVATARS.length)
      } else {
        // Front is now visible, back is hidden → update back to next avatar
        setBackIndex((prev) => (prev + 2) % GIO_AVATARS.length)
      }
      return nowShowingBack
    })
  }, [])

  const sizeClasses = size === 'sm' ? 'w-10 h-10' : 'w-20 h-20'

  // Determine the current rotation of the container
  // When not flipping, hold at 0 or 180 depending on which face is showing
  const baseRotation = showingBack ? 180 : 0

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div className={cn('relative', sizeClasses)} style={{ perspective: '800px' }}>
        <div
          className={cn(
            'relative w-full h-full',
            isFlipping && (showingBack ? 'animate-coin-flip-2d-reverse' : 'animate-coin-flip-2d')
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: !isFlipping ? `rotateY(${baseRotation}deg)` : undefined,
          }}
          onAnimationEnd={handleAnimationEnd}
        >
          {/* Front face */}
          <img
            src={GIO_AVATARS[frontIndex]}
            alt="Loading"
            className="absolute inset-0 w-full h-full rounded-full object-cover"
            style={{ backfaceVisibility: 'hidden' }}
          />
          {/* Back face - pre-rotated 180deg */}
          <img
            src={GIO_AVATARS[backIndex]}
            alt="Loading"
            className="absolute inset-0 w-full h-full rounded-full object-cover"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          />
        </div>
      </div>
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
