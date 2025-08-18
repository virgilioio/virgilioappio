import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getSkillColor, type PastelColor } from '@/utils/skillColors'
import { Clock, CheckCircle, TrendingUp } from 'lucide-react'

export interface SkillAnalysis {
  frequency?: number
  contextStrength?: 'junior' | 'mid' | 'senior' | 'expert'
  recency?: 'current' | 'recent' | 'past'
  matchRelevance?: number // 0-100 percentage
  experienceYears?: number
  contexts?: string[]
}

export interface EnhancedSkillBadgeProps {
  skill: string
  analysis?: SkillAnalysis
  variant?: 'compact' | 'detailed' | 'minimal'
  showTooltip?: boolean
  interactive?: boolean
  className?: string
}

function getFrequencyDisplay(frequency?: number): string {
  if (!frequency || frequency <= 1) return ''
  if (frequency >= 5) return '5x+'
  return `${frequency}x`
}

function getContextDisplay(contextStrength?: string): string {
  if (!contextStrength) return ''
  const contextMap = {
    junior: 'Jr',
    mid: 'Mid',
    senior: 'Sr',
    expert: 'Expert'
  }
  return contextMap[contextStrength as keyof typeof contextMap] || ''
}

function getRecencyIcon(recency?: string) {
  switch (recency) {
    case 'current': return <CheckCircle className="w-3 h-3" />
    case 'recent': return <Clock className="w-3 h-3" />
    case 'past': return null
    default: return null
  }
}

function getMatchRelevanceColor(relevance?: number): string {
  if (!relevance) return ''
  if (relevance >= 80) return 'text-success'
  if (relevance >= 60) return 'text-warning'
  return 'text-muted-foreground'
}

export function EnhancedSkillBadge({ 
  skill, 
  analysis = {}, 
  variant = 'compact',
  showTooltip = true,
  interactive = false,
  className 
}: EnhancedSkillBadgeProps) {
  const color = getSkillColor(skill)
  const frequencyDisplay = getFrequencyDisplay(analysis.frequency)
  const contextDisplay = getContextDisplay(analysis.contextStrength)
  const recencyIcon = getRecencyIcon(analysis.recency)
  const matchColor = getMatchRelevanceColor(analysis.matchRelevance)

  const badgeContent = (
    <div className="flex items-center gap-1">
      <span className="font-medium">{skill}</span>
      
      {variant !== 'minimal' && (
        <>
          {frequencyDisplay && (
            <span className="text-xs opacity-75">
              {frequencyDisplay}
            </span>
          )}
          
          {contextDisplay && (
            <span className="text-xs opacity-75">
              • {contextDisplay}
            </span>
          )}
          
          {recencyIcon && (
            <span className="opacity-75">
              {recencyIcon}
            </span>
          )}
        </>
      )}
      
      {analysis.matchRelevance && analysis.matchRelevance > 70 && (
        <TrendingUp className={cn("w-3 h-3", matchColor)} />
      )}
    </div>
  )

  const badge = (
    <Badge
      variant={color}
      interactive={interactive}
      className={cn(
        "text-xs font-medium",
        analysis.matchRelevance && analysis.matchRelevance > 80 && "ring-1 ring-success/30",
        analysis.frequency && analysis.frequency >= 5 && "font-semibold",
        className
      )}
    >
      {badgeContent}
    </Badge>
  )

  if (!showTooltip || !analysis || Object.keys(analysis).length === 0) {
    return badge
  }

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{skill}</div>
      {analysis.frequency && (
        <div className="text-xs">Mentioned {analysis.frequency} time{analysis.frequency > 1 ? 's' : ''}</div>
      )}
      {analysis.contextStrength && (
        <div className="text-xs">Context: {analysis.contextStrength} level</div>
      )}
      {analysis.recency && (
        <div className="text-xs">
          Recency: {analysis.recency === 'current' ? 'Current role' : 
                   analysis.recency === 'recent' ? 'Recent experience' : 
                   'Past experience'}
        </div>
      )}
      {analysis.experienceYears && (
        <div className="text-xs">{analysis.experienceYears} years experience</div>
      )}
      {analysis.matchRelevance && (
        <div className="text-xs">Match: {analysis.matchRelevance}%</div>
      )}
      {analysis.contexts && analysis.contexts.length > 0 && (
        <div className="text-xs">
          Found in: {analysis.contexts.join(', ')}
        </div>
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}