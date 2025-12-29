import { useState, useEffect } from 'react'
import gioAvatar from '@/assets/gio-avatar.png'
import gioFaceYellow from '@/assets/gio-face-yellow.png'

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
    <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in">
      {/* 3D Coin Container */}
      <div 
        className="relative"
        style={{ perspective: '800px' }}
      >
        {/* The Coin */}
        <div 
          className="relative w-20 h-20 animate-coin-flip"
          style={{ 
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Front Face - Main Gio Avatar */}
          <div 
            className="absolute inset-0 rounded-full overflow-hidden shadow-xl"
            style={{ 
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <img 
              src={gioAvatar} 
              alt="Gio"
              className="w-full h-full object-cover"
            />
            {/* Coin edge effect */}
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)'
              }}
            />
          </div>
          
          {/* Back Face - Yellow Gio */}
          <div 
            className="absolute inset-0 rounded-full overflow-hidden shadow-xl"
            style={{ 
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateX(180deg)',
            }}
          >
            <img 
              src={gioFaceYellow} 
              alt="Gio"
              className="w-full h-full object-cover"
            />
            {/* Coin edge effect */}
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)'
              }}
            />
          </div>
          
          {/* Coin Edge (depth) */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              transform: 'translateZ(-4px)',
              background: 'linear-gradient(to bottom, #d4a853, #b8942e, #d4a853)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
        </div>
        
        {/* Dynamic Shadow */}
        <div 
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-3 rounded-full bg-black/20 blur-sm animate-coin-shadow"
        />
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
