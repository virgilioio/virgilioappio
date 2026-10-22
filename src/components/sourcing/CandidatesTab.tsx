import { SourcingProject, SearchCriteria } from '@/types/sourcing'
import { SourcingCandidateTable } from './SourcingCandidateTable'
import { LinkToJobBanner } from './LinkToJobBanner'

import { LinkedJobStrip } from './LinkedJobStrip'
import type { LinkToJobPayload } from './LinkToJobDialog'

interface Candidate {
  id: string;
  candidate_name: string;
  current_role?: string;
  current_company?: string;
  location_city?: string;
  location_country?: string;
  linkedin_url?: string;
  match_score?: number | null;
  match_tier?: 'excellent' | 'good' | 'fair' | 'minimal' | null;
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
  full_name?: string;
  display_source?: 'internal' | 'gio' | 'apollo' | 'pdl';
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
  onLinkToJob?: (payload: LinkToJobPayload) => Promise<void> | void;
  onUnlinkJob?: () => Promise<void> | void;
  savedCandidatesCount?: number;
  onCandidatesChanged?: () => void | Promise<void>;
  totalMatches?: number;
  onClearFilters?: () => void;
  onEditSearch?: () => void;
  loadFailed?: boolean;
  onRetry?: () => void;
}

export function CandidatesTab({
  project,
  candidates,
  isLoading,
  jobId,
  projectId,
  searchCriteria,
  onLinkToJob,
  onUnlinkJob,
  savedCandidatesCount = 0,
  onCandidatesChanged,
  totalMatches,
  onClearFilters,
  onEditSearch,
  loadFailed,
  onRetry,
}: CandidatesTabProps) {
  const linkedJobId = jobId || project.job_id || null

  return (
    <div className="flex-1 min-h-0 overflow-hidden h-full flex flex-col">
      {/* The linked job, or the offer to link one, once there are results. */}
      {!isLoading && candidates.length > 0 && (
        <div className="px-4 pt-4 shrink-0">
          {linkedJobId ? (
            <LinkedJobStrip
              jobId={linkedJobId}
              jobTitle={project.jobs?.title}
              department={project.jobs?.organizations?.name}
              onUnlink={() => onUnlinkJob?.()}
            />
          ) : (
            onLinkToJob && (
              <LinkToJobBanner
                onLinkToJob={onLinkToJob}
                currentJobId={project.job_id}
                project={project}
                savedCandidatesCount={savedCandidatesCount}
                organizationName={project.jobs?.organizations?.name}
              />
            )
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 pt-4">
        <SourcingCandidateTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the search rows carry more than this type lists
          candidates={candidates as any}
          isLoading={isLoading}
          jobId={linkedJobId}
          jobTitle={project.jobs?.title ?? null}
          projectId={projectId}
          searchCriteria={searchCriteria || project.search_criteria}
          onCandidatesChanged={onCandidatesChanged}
          totalMatches={totalMatches}
          onClearFilters={onClearFilters}
          onEditSearch={onEditSearch}
          loadFailed={loadFailed}
          onRetry={onRetry}
          organizationId={project.organization_id}
        />
      </div>
    </div>
  )
}
