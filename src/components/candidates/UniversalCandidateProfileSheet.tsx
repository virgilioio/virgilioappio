import CandidateProfileSheet from './CandidateProfileSheet'
import { IndependentCandidateProfileSheet } from './IndependentCandidateProfileSheet'

interface UniversalCandidateProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  jobId?: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onStageChanged?: () => void
  context?: 'job' | 'independent' | 'sourcing'
}

export default function UniversalCandidateProfileSheet(props: UniversalCandidateProfileSheetProps) {
  // Auto-detect context if not provided
  const actualContext = props.context || (props.jobId ? 'job' : 'independent')
  
  // If job context, use the existing CandidateProfileSheet (UNCHANGED)
  if (actualContext === 'job' && props.jobId) {
    return <CandidateProfileSheet {...props} jobId={props.jobId} />
  }
  
  // Otherwise, use the new IndependentCandidateProfileSheet
  return <IndependentCandidateProfileSheet {...props} />
}
