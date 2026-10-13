import { supabase } from '@/lib/supabaseClient'
import { Replace } from 'lucide-react'
import { confirmDestructive } from '@/components/ui/confirm-dialog'

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

const whose = (name?: string | null) => {
  const n = name?.trim()
  return n ? `${n}’s` : 'this candidate’s'
}

/**
 * C17 (Block B §16, Pattern 1): uploading a new résumé deletes the old one
 * (removeOldResumes), so it asks first whenever a résumé is already on file.
 * Resolves true straight away when there's nothing to replace.
 */
export function confirmReplaceResume(opts: {
  candidateName?: string | null
  oldFileName?: string | null
  newFileName: string
  hasResume: boolean
}): Promise<boolean> {
  if (!opts.hasResume) return Promise.resolve(true)
  const old = opts.oldFileName?.trim()
  return confirmDestructive({
    icon: Replace,
    title: `Replace ${whose(opts.candidateName)} résumé?`,
    description: `${opts.newFileName} replaces ${old || 'the résumé on file'}, and the old file is deleted. Gio re-reads the new one and refreshes the Gio Fit scores. Other files stay. This can’t be undone.`,
    confirmLabel: 'Replace résumé',
  })
}

/** C16 (Block B §16, Pattern 1): delete the résumé file; parsed details stay. */
export function confirmDeleteResume(opts: { candidateName?: string | null; fileName?: string | null }): Promise<boolean> {
  const file = opts.fileName?.trim()
  return confirmDestructive({
    title: `Delete ${whose(opts.candidateName)} résumé?`,
    description: `${file ? `${file} is` : 'The file is'} deleted. The details read from it stay on the profile. This can’t be undone.`,
    confirmLabel: 'Delete résumé',
  })
}
