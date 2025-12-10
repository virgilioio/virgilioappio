import { SourcingFiltersPanel } from './SourcingFiltersPanel';
import { SourcingCandidateTable } from './SourcingCandidateTable';
import { SourcingProject, SourcingProjectFilters, SearchCriteria } from '@/types/sourcing';

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
  filters: SourcingProjectFilters;
  onFiltersChange: (filters: SourcingProjectFilters) => void;
  onUpdateSearchCriteria: (criteria: SearchCriteria) => Promise<void>;
  isRefreshing: boolean;
  isLoading: boolean;
}

export function CandidatesTab({
  project,
  candidates,
  filters,
  onFiltersChange,
  onUpdateSearchCriteria,
  isRefreshing,
  isLoading
}: CandidatesTabProps) {
  return (
    <div className="flex h-full">
      <SourcingFiltersPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        project={project}
        onUpdateSearchCriteria={onUpdateSearchCriteria}
        isRefreshing={isRefreshing}
      />
      <div className="flex-1 overflow-auto">
        <SourcingCandidateTable
          candidates={candidates}
          isLoading={isLoading}
          jobId={project.job_id}
        />
      </div>
    </div>
  );
}
