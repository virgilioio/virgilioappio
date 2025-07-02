import React from 'react'
import { Check, AlertTriangle, HelpCircle } from 'lucide-react'

interface FieldConfidenceIndicatorProps {
  confidence: 'high' | 'medium' | 'low'
  aiExtracted: boolean
  className?: string
}

export function FieldConfidenceIndicator({ confidence, aiExtracted, className = '' }: FieldConfidenceIndicatorProps) {
  if (!aiExtracted) return null

  const getIcon = () => {
    switch (confidence) {
      case 'high':
        return <Check className="h-3 w-3 text-success" />
      case 'medium':
        return <AlertTriangle className="h-3 w-3 text-warning" />
      case 'low':
        return <HelpCircle className="h-3 w-3 text-muted-foreground" />
    }
  }

  const getConfidenceText = () => {
    switch (confidence) {
      case 'high':
        return 'High confidence'
      case 'medium':
        return 'Medium confidence'
      case 'low':
        return 'Low confidence'
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {getIcon()}
      <span className="text-xs text-muted-foreground">
        AI • {getConfidenceText()}
      </span>
    </div>
  )
}