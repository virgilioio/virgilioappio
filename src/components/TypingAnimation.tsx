
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
      const pauseTimeout = setTimeout(() => {
        setIsTyping(false)
        setIsSliding(true)
        
        // Start sliding animation, then reset
        const slideTimeout = setTimeout(() => {
          setCurrentText('')
          setIsSliding(false)
          setIsTyping(true)
          setCurrentTitleIndex((prev) => (prev + 1) % jobTitles.length)
        }, 500) // Duration of slide animation
        
        return () => clearTimeout(slideTimeout)
      }, 1500) // Pause before sliding
      
      return () => clearTimeout(pauseTimeout)
    }
  }, [currentText, currentTitleIndex, isTyping, isSliding])

  return (
    <div className="text-left">
      {/* Static Headline */}
      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-poppins font-normal text-primary leading-tight max-w-4xl">
        For all your hiring needs. <span className="font-bold">Globally.</span>
      </h1>
      
      {/* Animated Job Titles Container */}
      <div className="relative h-12 sm:h-14 md:h-16 lg:h-16 xl:h-20 2xl:h-24 flex items-center mt-1">
        <div 
          className={`text-xl sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-poppins font-bold text-text-primary transition-all duration-500 max-w-4xl ${
            isSliding ? 'transform -translate-y-8 opacity-0' : 'transform translate-y-0 opacity-100'
          }`}
        >
          {currentText}
        </div>
      </div>
    </div>
  )
}
