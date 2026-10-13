import { supabase } from '@/lib/supabaseClient'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import type { JobStage } from '@/hooks/useJobStages'
import { toast } from '@/hooks/use-toast'

interface StageUsage {
  jobs: number
  candidates: number
  scorecards: number
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * What deleting a library stage touches (reassign_candidates_for_stage):
 * every job using it loses the stage, candidates in it move to the stage before
 * (or out of the pipeline), and its scorecards, interviewers and automations on
 * those jobs are deleted (ON DELETE CASCADE from job_hiring_stages).
 * Null when the counts couldn't be read.
 */
async function stageUsage(stageId: string): Promise<StageUsage | null> {
  try {
    const { data: instances, error } = await supabase
      .from('job_hiring_stages')
      .select('id, job_id')
      .eq('stage_id', stageId)
    if (error) return null
    const ids = (instances || []).map((r) => r.id as string)
    const jobs = new Set((instances || []).map((r) => r.job_id as string)).size
    if (!ids.length) return { jobs: 0, candidates: 0, scorecards: 0 }
    const chunk = ids.slice(0, 200)
    const [cands, cards] = await Promise.all([
      supabase.from('job_candidate_associations').select('id', { count: 'exact', head: true }).in('current_stage_id', chunk),
      supabase.from('job_stage_scorecards').select('id', { count: 'exact', head: true }).in('stage_instance_id', chunk),
    ])
    if (cands.error || cards.error) return null
    return { jobs, candidates: cands.count ?? 0, scorecards: cards.count ?? 0 }
  } catch {
    return null
  }
}

/**
 * S7 / S8 (Block B §16): delete a stage from the library. Type to confirm when
 * candidates sit in it (or the counts are unknown) and always for a global
 * default stage; otherwise a single confirm. `onDelete` should not toast its
 * own errors: the dialog shows them inline (typed) or one toast does (single).
 */
export async function confirmDeleteStage(
  stage: JobStage,
  opts: { global: boolean; onDelete: () => Promise<void> },
): Promise<void> {
  const name = stage.stage_name?.trim() || 'this stage'
  const usage = await stageUsage(stage.id)
  const where = opts.global ? ' in every workspace' : ''

  let description: string
  if (!usage) {
    description = `Every job${where} that uses it loses the stage. Candidates in it move to the stage before, and its scorecards, interviewers and automations on those jobs are deleted. Jobs and candidates stay. This can’t be undone.`
  } else if (usage.jobs === 0) {
    description = `No jobs${where} use it, so no candidates or scorecards are affected. It’s no longer offered when you build a pipeline. This can’t be undone.`
  } else {
    const moved = usage.candidates
      ? ` ${plural(usage.candidates, 'candidate')} in it move${usage.candidates === 1 ? 's' : ''} to the stage before (or out of the pipeline if it’s first).`
      : ''
    const cards = usage.scorecards ? `${plural(usage.scorecards, 'scorecard')}, its` : 'Its'
    description = `${plural(usage.jobs, 'job')}${where} lose${usage.jobs === 1 ? 's' : ''} this stage.${moved} ${cards} interviewers and automations on those jobs are deleted. Jobs and candidates stay. This can’t be undone.`
  }

  const typed = opts.global || !usage || usage.candidates > 0
  const friendly = (e: unknown) => {
    const msg = String((e as { message?: unknown } | null)?.message ?? '')
    return msg.includes('Only platform administrators') || msg.includes('Only workspace owners')
      ? `Only ${opts.global ? 'platform admins' : 'workspace owners'} can delete ${name}.`
      : `Couldn\u2019t delete ${name}. Nothing was removed; try again.`
  }
  const ok = await confirmDestructive({
    title: opts.global ? `Delete ${name} from every workspace?` : `Delete ${name}?`,
    description,
    confirmLabel: 'Delete stage',
    typeToConfirm: typed ? name : undefined,
    onConfirm: typed
      ? async () => {
          try {
            await opts.onDelete()
          } catch (e) {
            throw new Error(friendly(e))
          }
        }
      : undefined,
  })
  if (ok && !typed) {
    try {
      await opts.onDelete()
    } catch (e) {
      toast({ title: friendly(e), variant: 'destructive' })
    }
  }
}
