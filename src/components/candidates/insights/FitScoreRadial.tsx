import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'

interface FitScoreRadialProps {
  score: number
  confidence: 'low' | 'medium' | 'high'
  confidenceReason: string
  generatedAt: string | null
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

function getScoreTrackColor(score: number): string {
  if (score >= 80) return 'stroke-green-500'
  if (score >= 60) return 'stroke-yellow-500'
  if (score >= 40) return 'stroke-orange-500'
  return 'stroke-red-500'
}

function getConfidenceBadgeVariant(confidence: string): 'default' | 'secondary' | 'outline' {
  if (confidence === 'high') return 'default'
  if (confidence === 'medium') return 'secondary'
  return 'outline'
}

export function FitScoreRadial({ score, confidence, confidenceReason, generatedAt }: FitScoreRadialProps) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="50" cy="50" r={radius} fill="none" strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className={getScoreTrackColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={getConfidenceBadgeVariant(confidence)} className="w-fit capitalize cursor-help">
                {confidence} confidence
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <p className="text-xs">{confidenceReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {generatedAt && (
          <span className="text-xs text-text-tertiary">
            Updated {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  )
}
