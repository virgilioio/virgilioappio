import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDistanceToNow } from 'date-fns'

interface FitScoreRadialProps {
  score: number
  confidence: 'low' | 'medium' | 'high'
  confidenceReason: string
  generatedAt: string | null
}

function getScoreOpacity(score: number): string {
  if (score >= 80) return 'opacity-100'
  if (score >= 60) return 'opacity-80'
  if (score >= 40) return 'opacity-50'
  return 'opacity-30'
}

function getConfidenceBadgeStyle(confidence: string): string {
  if (confidence === 'high') return 'bg-virgilio-purple/20 text-virgilio-purple border-virgilio-purple/30'
  if (confidence === 'medium') return 'bg-virgilio-purple/10 text-virgilio-purple/80 border-virgilio-purple/20'
  return 'bg-muted text-muted-foreground border-border'
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
            className={`stroke-virgilio-purple ${getScoreOpacity(score)}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-poppins font-bold text-virgilio-purple ${getScoreOpacity(score)}`}>{score}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`w-fit capitalize cursor-help font-poppins text-xs ${getConfidenceBadgeStyle(confidence)}`}>
                {confidence} confidence
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] rounded-2xl shadow-lg font-poppins">
              <p className="text-xs">{confidenceReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {generatedAt && (
          <span className="text-xs text-virgilio-muted font-poppins">
            Updated {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  )
}
