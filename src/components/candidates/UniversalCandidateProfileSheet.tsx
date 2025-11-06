import CandidateProfileSheet from './CandidateProfileSheet'
import { IndependentCandidateProfileSheet } from './IndependentCandidateProfileSheet'
import { CoreSignalPreviewSheet } from './CoreSignalPreviewSheet'

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
  coresignalId?: string | null
  coresignalData?: {
    candidate_name: string
    headline?: string
    location?: string
    current_company?: string
    current_role?: string
    linkedin_url?: string
    coresignal_score?: number
  }
}

export default function UniversalCandidateProfileSheet(props: UniversalCandidateProfileSheetProps) {
  // Auto-detect context if not provided
  const actualContext = props.context || (props.jobId ? 'job' : 'independent')
  
  // If CoreSignal preview (has coresignalId but no candidateId)
  if (props.coresignalId && !props.candidateId) {
    return <CoreSignalPreviewSheet {...props} />
  }
  
  // If job context, use the existing CandidateProfileSheet (UNCHANGED)
  if (actualContext === 'job' && props.jobId) {
    return <CandidateProfileSheet {...props} jobId={props.jobId} />
  }
  
  // Otherwise, use the new IndependentCandidateProfileSheet
  return <IndependentCandidateProfileSheet {...props} />
}
