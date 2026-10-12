import { supabase } from '@/lib/supabaseClient'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Resolution } from './types'

async function invoke(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke('merge-candidates', { body })
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message
    throw new Error(details)
  }
  if (data?.error) throw new Error(String(data.error))
  return data as { candidate_id: string; audit_log_id?: string; created_separate?: boolean }
}

export interface MergeArgs {
  existingCandidateId: string
  incoming: Record<string, any>
  resolutions: Record<string, Resolution>
  jobId?: string | null
  stageId?: string | null
  notes?: string | null
  /** Record-to-record merge: this candidate's applications, notes and files move to the existing one. */
  mergedCandidateId?: string | null
  resumeAttachment?: {
    file_name: string
    file_url: string
    file_size_bytes?: number | null
    file_type?: string | null
  } | null
}

export function performMerge(args: MergeArgs) {
  return invoke({
    action: 'merge',
    surviving_candidate_id: args.existingCandidateId,
    incoming: args.incoming,
    resolutions: args.resolutions,
    job_id: args.jobId ?? null,
    stage_id: args.stageId ?? null,
    notes: args.notes ?? null,
    resume_attachment: args.resumeAttachment ?? null,
    merged_candidate_id: args.mergedCandidateId ?? null,
  })
}

/** Two records already in Gio are different people: never raise the pair again. */
export function performNotDuplicatePair(args: { candidateId: string; otherCandidateId: string }) {
  return invoke({
    action: 'not_duplicate_pair',
    existing_candidate_id: args.candidateId,
    other_candidate_id: args.otherCandidateId,
  })
}

export function performNotDuplicate(args: {
  existingCandidateId: string
  incoming: Record<string, any>
  jobId?: string | null
  stageId?: string | null
  notes?: string | null
  organizationId?: string | null
}) {
  return invoke({
    action: 'not_duplicate',
    existing_candidate_id: args.existingCandidateId,
    incoming: args.incoming,
    job_id: args.jobId ?? null,
    stage_id: args.stageId ?? null,
    notes: args.notes ?? null,
    organization_id: args.organizationId ?? null,
  })
}
