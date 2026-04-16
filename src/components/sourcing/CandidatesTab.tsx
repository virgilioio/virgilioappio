import { SourcingProject, SearchCriteria } from '@/types/sourcing'
import { SourcingCandidateTable } from './SourcingCandidateTable'

interface Candidate {
  id: string;
  candidate_name: string;
  current_role?: string;
  current_company?: string;
  location_city?: string;
  location_country?: string;
  linkedin_url?: string;
  match_score: number;
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal';
  skills?: string[];
  years_experience?: number;
  source: 'local' | 'apollo' | 'pdl';
  apollo_id?: string;
  apollo_score?: number;
  headline?: string;
  email?: string;
  email_status?: string;
  phone?: string;
  candidate_id?: string | null;
}

interface CandidatesTabProps {
  project: SourcingProject;
  candidates: Candidate[];
  isLoading: boolean;
  jobId?: string;
  projectId: string;
  searchCriteria?: SearchCriteria;
  sourceBreakdown?: {
    internal?: number;
    gio?: number;
    pdl: number;
    apollo: number;
    full_data: number;
    preview_only: number;
  };
}

export function CandidatesTab({
  project,
  candidates,
  isLoading,
  jobId,
  projectId,
  searchCriteria,
  sourceBreakdown,
}: CandidatesTabProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <SourcingCandidateTable
          candidates={candidates}
          isLoading={isLoading}
          jobId={jobId || project.job_id}
          projectId={projectId}
          searchCriteria={searchCriteria || project.search_criteria}
          sourceBreakdown={sourceBreakdown}
        />
      </div>
    </div>
  )
}
