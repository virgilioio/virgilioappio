
import { useState, useEffect } from 'react'

const jobTitles = [
  "Software Engineers",
  "Product Managers", 
  "Data Scientists",
  "UX/UI Designers",
  "Marketing Specialists",
  "Sales Representatives",
  "DevOps Engineers",
  "Business Analysts"
]

export function TypingAnimation() {
  const [currentTitleIndex, setCurrentTitleIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [showCursor, setShowCursor] = useState(true)
  const [isSliding, setIsSliding] = useState(false)

  useEffect(() => {
    const currentTitle = jobTitles[currentTitleIndex]
    
    if (isTyping && currentText.length < currentTitle.length) {
      // Typing characters
      const timeout = setTimeout(() => {
        setCurrentText(currentTitle.slice(0, currentText.length + 1))
      }, 120)
      return () => clearTimeout(timeout)
    } else if (isTyping && currentText.length === currentTitle.length) {
      // Finished typing, pause before sliding
      setIsTyping(false)
      const timeout = setTimeout(() => {
        setIsSliding(true)
        // Start sliding animation
        setTimeout(() => {
          // Reset for next title
          setCurrentText('')
          setIsSliding(false)
          setIsTyping(true)
          setCurrentTitleIndex((prev) => (prev + 1) % jobTitles.length)
        }, 500) // Duration of slide animation
      }, 1500) // Pause before sliding
      return () => clearTimeout(timeout)
    }
  }, [currentText, currentTitleIndex, isTyping])

  // Cursor blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center">
      {/* Static Headline */}
      <h1 className="text-4xl xl:text-5xl font-poppins font-semibold text-primary mb-8 leading-tight">
        For all your hiring needs.<br />
        Globally.
      </h1>
      
      {/* Animated Job Titles Container */}
      <div className="relative h-16 flex items-center justify-center">
        <div 
          className={`text-2xl xl:text-3xl font-inter font-medium text-text-primary transition-all duration-500 ${
            isSliding ? 'transform -translate-y-8 opacity-0' : 'transform translate-y-0 opacity-100'
          }`}
        >
          {currentText}
          <span 
            className={`inline-block w-0.5 h-8 bg-primary ml-1 ${
              showCursor ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transition: 'opacity 0.1s' }}
          />
        </div>
      </div>
    </div>
  )
}
