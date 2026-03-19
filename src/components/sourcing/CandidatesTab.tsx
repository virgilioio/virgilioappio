import { SourcingCandidateTable } from './SourcingCandidateTable';
import { SourcingProject, SearchCriteria } from '@/types/sourcing';

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
  source: 'local' | 'apollo';
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
}

export function CandidatesTab({
  project,
  candidates,
  isLoading
}: CandidatesTabProps) {
  return (
    <div className="flex-1 overflow-auto h-full">
      <SourcingCandidateTable
        candidates={candidates}
        isLoading={isLoading}
        jobId={project.job_id}
        projectId={project.id}
        searchCriteria={project.search_criteria}
      />
    </div>
  );
}