import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GioFitProgressBar } from './GioFitNarration'
import './gioFitLoading.css'

interface GioFitRescoringBarProps {
  stepLabel: string
  progress: number
  previousGeneratedAt: string | null
  onCancel: () => void
  /** Overrides the sub-line wording; receives the formatted date of the dossier on screen. */
  noteForDate?: (date: string) => string
}

function formatPreviousDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function GioFitRescoringBar({ stepLabel, progress, previousGeneratedAt, onCancel }: GioFitRescoringBarProps) {
  const previousDate = formatPreviousDate(previousGeneratedAt)
  return (
    <div className="gf-rescore-bar">
      <span className="gf-rescore-chip" aria-hidden><Sparkles className="h-3.5 w-3.5" /></span>
      <div className="min-w-0">
        <p className="gf-rescore-title">Re-scoring · {stepLabel.toLowerCase()}</p>
        {previousDate && <p className="gf-rescore-note">Showing the previous dossier from {previousDate} until the new one lands</p>}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <div className="w-[132px]"><GioFitProgressBar progress={progress} /></div>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
