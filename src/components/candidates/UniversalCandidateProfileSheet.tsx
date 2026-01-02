import CandidateProfileSheet from './CandidateProfileSheet'
import { IndependentCandidateProfileSheet } from './IndependentCandidateProfileSheet'
import { ApolloPreviewSheet } from './ApolloPreviewSheet'
import type { SearchCriteria } from '@/types/sourcing'

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
  apolloId?: string | null
  apolloData?: {
    candidate_name: string
    headline?: string
    location?: string
    current_company?: string
    current_role?: string
    linkedin_url?: string
    apollo_score?: number
    email?: string
    email_status?: string
    phone?: string
    industry?: string
    connections_count?: number
    follower_count?: number
    company_url?: string
    company_website?: string
    company_industry?: string
    experience_location?: string
    // Availability flags
    has_email?: boolean
    has_phone?: boolean
    has_location?: boolean
  }
  searchCriteria?: SearchCriteria
  onCandidateCollected?: (candidateId: string, apolloId: string) => void
}

export default function UniversalCandidateProfileSheet(props: UniversalCandidateProfileSheetProps) {
  // Auto-detect context if not provided
  const actualContext = props.context || (props.jobId ? 'job' : 'independent')
  
  // If Apollo preview (has apolloId but no candidateId)
  if (props.apolloId && !props.candidateId) {
    return (
      <ApolloPreviewSheet 
        {...props} 
        onCandidateCollected={(candidateId) => {
          props.onCandidateCollected?.(candidateId, props.apolloId!)
        }}
      />
    )
  }
  
  // If job context, use the existing CandidateProfileSheet (UNCHANGED)
  if (actualContext === 'job' && props.jobId) {
    return <CandidateProfileSheet {...props} jobId={props.jobId} />
  }
  
  // Otherwise, use the new IndependentCandidateProfileSheet
  return <IndependentCandidateProfileSheet {...props} />
}
