import { useMemo } from 'react'
import { SourcingProject, SearchCriteria } from '@/types/sourcing'
import { SourcingCandidateTable } from './SourcingCandidateTable'
import { LinkToJobBanner } from './LinkToJobBanner'

import { LinkedJobStrip } from './LinkedJobStrip'
import { ResultsRunSummary } from './ResultsRunSummary'
import type { LinkToJobPayload } from './LinkToJobDialog'

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
}

export function CandidatesTab({
  project,
  candidates,
  isLoading,
  jobId,
  projectId,
  searchCriteria,
  sourceBreakdown,
  onLinkToJob,
  onUnlinkJob,
  savedCandidatesCount = 0,
  onCandidatesChanged,
}: CandidatesTabProps) {
  // Run summary stats — derived from candidates
  const summary = useMemo(() => {
    let strongFit = 0
    let good = 0
    let possible = 0
    let alreadyCollected = 0
    let top: Candidate | null = null

    for (const c of candidates) {
      if (c.match_tier === 'excellent') strongFit++
      else if (c.match_tier === 'good') good++
      else if (c.match_tier === 'fair' || c.match_tier === 'minimal') possible++

      const isInternal =
        c.display_source === 'internal' ||
        (c.source === 'apollo' && !!c.candidate_id)
      if (isInternal) alreadyCollected++

      if (!top || (c.match_score ?? 0) > (top.match_score ?? 0)) top = c
    }

    return {
      total: candidates.length,
      strongFit,
      good,
      possible,
      alreadyCollected,
      topName: top ? (top.full_name || top.candidate_name) : null,
      topScore: top ? top.match_score : null,
    }
  }, [candidates])

  const isLinked = !!(jobId || project.job_id)

  return (
    <div className="flex-1 min-h-0 overflow-hidden h-full flex flex-col">
      {/* Banner zone — only when results exist and not loading */}
      {!isLoading && candidates.length > 0 && (
        <div className="px-4 pt-4 space-y-2 shrink-0">
          {isLinked ? (
            <>
              <LinkedJobStrip
                jobId={(jobId || project.job_id)!}
                jobTitle={project.jobs?.title}
                department={project.jobs?.organizations?.name}
                onUnlink={() => onUnlinkJob?.()}
              />
            </>
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
          <ResultsRunSummary
            totalCount={summary.total}
            strongFit={summary.strongFit}
            good={summary.good}
            possible={summary.possible}
            alreadyCollected={summary.alreadyCollected}
            topMatchName={summary.topName}
            topMatchScore={summary.topScore}
            sourceBreakdown={sourceBreakdown}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 pt-4">
        <SourcingCandidateTable
          candidates={candidates}
          isLoading={isLoading}
          jobId={jobId || project.job_id}
          projectId={projectId}
          searchCriteria={searchCriteria || project.search_criteria}
          sourceBreakdown={sourceBreakdown}
          onCandidatesChanged={onCandidatesChanged}
        />
      </div>
    </div>
  )
}
