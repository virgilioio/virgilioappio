import { supabase } from '@/lib/supabaseClient'

/**
 * A replaced resume is not kept: once the new resume is saved, every other
 * resume record for the candidate is deleted along with its stored file.
 */
export async function removeOldResumes(candidateId: string, oldIds: string[]) {
  if (!candidateId || !oldIds.length) return
  const { data: rows } = await supabase
    .from('candidate_attachments')
    .select('id, file_url')
    .eq('candidate_id', candidateId)
    .in('id', oldIds)
  if (!rows?.length) return
  const { error } = await supabase.from('candidate_attachments').delete().in('id', rows.map((r) => r.id))
  if (error) {
    console.warn('[removeOldResumes] could not delete old resume rows', error)
    return
  }
  const paths = rows.map((r) => r.file_url).filter(Boolean) as string[]
  if (paths.length) await supabase.storage.from('candidate-attachments').remove(paths)
}

export async function currentResumeIds(candidateId: string): Promise<string[]> {
  const { data } = await supabase
    .from('candidate_attachments')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('is_resume', true)
  return (data || []).map((r) => r.id)
}
