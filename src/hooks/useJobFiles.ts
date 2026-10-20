import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { extractTextFromFile } from '@/utils/pdfText'

/**
 * A job's source documents (job_files + the private job-files bucket): intake
 * notes, client briefs, old JDs. Their text, read in the browser on upload,
 * feeds "Draft with Gio" and the skills generator (_shared/jobSources.ts).
 */
export interface JobFile {
  id: string
  job_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  /** Whether any text could be read from it (a scanned PDF has none). */
  has_text: boolean
  created_at: string
}

export const JOB_FILE_MAX_BYTES = 25 * 1024 * 1024
export const JOB_FILE_ACCEPT = '.pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf,text/rtf'
const EXT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  rtf: 'application/rtf',
}
const MAX_TEXT = 200000

// job_files arrives in the generated types once its migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jobFiles = () => (supabase as any).from('job_files')

export const jobFilesKey = (jobId: string | null | undefined) => ['job-files', jobId ?? null] as const

/** The type to store a file as, or null when the job's files don't take it. */
export function jobFileType(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt = EXT_TYPES[ext]
  if (!byExt) return null
  return file.type && Object.values(EXT_TYPES).includes(file.type) ? file.type : byExt
}

function safeName(name: string) {
  return name.replace(/[^\w.\- ()]+/g, '_').slice(-120) || 'file'
}

export function useJobFiles(jobId: string | null | undefined) {
  const qc = useQueryClient()
  const key = jobFilesKey(jobId)

  const query = useQuery({
    queryKey: key,
    enabled: !!jobId,
    queryFn: async (): Promise<JobFile[]> => {
      const { data, error } = await jobFiles()
        .select('id, job_id, file_name, storage_path, mime_type, size_bytes, extracted_text, created_at')
        .eq('job_id', jobId)
        .is('removed_at', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map(({ extracted_text, ...row }: JobFile & { extracted_text: string | null }) => ({
        ...row,
        has_text: !!extracted_text?.trim(),
      }))
    },
  })

  /** Reads the file's text, stores the file, then records it on the job. */
  const upload = useCallback(
    async (file: File): Promise<JobFile> => {
      if (!jobId) throw new Error('Save the job first')
      const type = jobFileType(file)
      if (!type) throw new Error(`${file.name}: use a PDF, Word (.docx) or text file`)
      if (file.size > JOB_FILE_MAX_BYTES) throw new Error(`${file.name} is over 25 MB`)
      const text = (await extractTextFromFile(file).catch(() => '')).slice(0, MAX_TEXT)
      const path = `${jobId}/${crypto.randomUUID()}-${safeName(file.name)}`
      const { error: upErr } = await supabase.storage.from('job-files').upload(path, file, { contentType: type })
      if (upErr) throw upErr
      const { data, error } = await jobFiles()
        .insert({
          job_id: jobId,
          file_name: file.name.slice(0, 255),
          storage_path: path,
          mime_type: type,
          size_bytes: file.size,
          extracted_text: text || null,
        })
        .select('id, job_id, file_name, storage_path, mime_type, size_bytes, created_at')
        .single()
      if (error) throw error
      const row: JobFile = { ...data, has_text: !!text.trim() }
      qc.setQueryData<JobFile[]>(key, (prev) => [...(prev ?? []), row])
      return row
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobId, qc],
  )

  /** Takes a file off the job (kept for the record; Gio stops reading it). */
  const remove = useCallback(
    async (id: string) => {
      const prev = qc.getQueryData<JobFile[]>(key)
      qc.setQueryData<JobFile[]>(key, (rows) => (rows ?? []).filter((r) => r.id !== id))
      const { error } = await jobFiles().update({ removed_at: new Date().toISOString() }).eq('id', id)
      if (error) {
        qc.setQueryData(key, prev)
        throw error
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobId, qc],
  )

  return { files: query.data ?? [], isLoading: query.isLoading, loadError: query.error, refetch: query.refetch, upload, remove }
}
