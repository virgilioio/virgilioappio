import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import './gioFitLoading.css'

export interface NarrationStep {
  label: string
  detail: string
}

/** The function's real stages, in order. */
export function buildNarrationSteps(outputLanguageName: string): NarrationStep[] {
  return [
    { label: 'Gathering the candidate file', detail: 'Résumé, work history, education, scorecards' },
    { label: 'Reading the job', detail: 'Required skills, band, location, description' },
    { label: 'Comparing across seven dimensions', detail: 'Skills, experience, role, location, salary, language, pedigree' },
    { label: 'Scoring what the evidence supports', detail: 'Weighted mean of the dimensions that could be assessed' },
    { label: 'Writing the dossier', detail: `Summary, insights, and validation points in ${outputLanguageName}` },
  ]
}

/** Observed p50 for the scoring call. Quoted to the user, and used to pace the steps. */
export const GIO_FIT_P50_SECONDS = 15

// Calibrated to the p50 above. The last step never completes while the request is
// still open — it is held at "active" until the response actually lands.
const STEP_SECONDS = [2.5, 2, 4, 3, 3.5]
const TOTAL_SECONDS = STEP_SECONDS.reduce((sum, value) => sum + value, 0)

/**
 * Advances narration while a request is in flight. Progress is capped below 100%
 * and the final step is never marked done until `active` turns false.
 */
export function useGioFitNarration(active: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      startRef.current = null
      setElapsed(0)
      return
    }
    startRef.current = Date.now()
    const id = window.setInterval(() => {
      if (startRef.current) setElapsed((Date.now() - startRef.current) / 1000)
    }, 200)
    return () => window.clearInterval(id)
  }, [active])

  let remaining = elapsed
  let stepIndex = 0
  for (let index = 0; index < STEP_SECONDS.length; index += 1) {
    if (remaining < STEP_SECONDS[index]) {
      stepIndex = index
      break
    }
    remaining -= STEP_SECONDS[index]
    stepIndex = Math.min(index + 1, STEP_SECONDS.length - 1)
  }

  const progress = Math.min(0.92, elapsed / TOTAL_SECONDS)
  return { stepIndex, progress }
}

export function GioFitProgressBar({ progress }: { progress: number }) {
  return (
    <div className="gf-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
      <div className="gf-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  )
}

export function GioFitNarration({ steps, stepIndex }: { steps: NarrationStep[]; stepIndex: number }) {
  return (
    <div aria-live="polite">
      {steps.map((step, index) => {
        const state = index < stepIndex ? 'done' : index === stepIndex ? 'active' : 'pending'
        return (
          <div key={step.label} className="gf-step">
            <span className={`gf-step-marker gf-step-marker--${state}`} aria-hidden>
              {state === 'done' && <Check className="h-2.5 w-2.5" strokeWidth={2.75} />}
            </span>
            <div className="min-w-0">
              <p className={`gf-step-label gf-step-label--${state}`}>{step.label}</p>
              {state === 'active' && <p className="gf-step-detail">{step.detail}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
