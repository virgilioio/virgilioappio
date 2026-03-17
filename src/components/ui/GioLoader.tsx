import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import gioAvatar from '@/assets/gio-avatar.png'
import gioFaceYellow from '@/assets/gio-face-yellow.png'
import gioFaceEmpty from '@/assets/gio-face-empty.png'
import gioFacePurple from '@/assets/gio-face-purple.png'
import gioFacePink from '@/assets/gio-face-pink.png'
import gioFaceGreen from '@/assets/gio-face-green.png'

export const GIO_AVATARS = [gioAvatar, gioFaceYellow, gioFacePurple, gioFacePink, gioFaceGreen]

interface GioLoaderProps {
  size?: 'sm' | 'md'
  message?: string
  className?: string
}

export function GioLoader({ size = 'md', message, className }: GioLoaderProps) {
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [isMirrored, setIsMirrored] = useState(false)

  const triggerFlip = useCallback(() => {
    setIsFlipping(true)
    setTimeout(() => {
      setAvatarIndex((prev) => (prev + 1) % GIO_AVATARS.length)
    }, 175)
    setTimeout(() => {
      setIsFlipping(false)
      setIsMirrored((prev) => !prev)
    }, 500)
  }, [])

  useEffect(() => {
    const interval = setInterval(triggerFlip, 1200)
    return () => clearInterval(interval)
  }, [triggerFlip])

  const sizeClasses = size === 'sm' ? 'w-10 h-10' : 'w-20 h-20'

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div className={cn('relative', sizeClasses)}>
        <img
          src={GIO_AVATARS[avatarIndex]}
          alt="Loading"
          className={cn(
            'w-full h-full rounded-full object-cover will-change-transform',
            isFlipping && (isMirrored ? 'animate-coin-flip-2d-reverse' : 'animate-coin-flip-2d')
          )}
          style={{ transform: isMirrored ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        />
      </div>
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
