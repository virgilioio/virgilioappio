import React from 'react'
import { AlertTriangle, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { IconTip } from '@/components/ui/tooltip'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { FileTypeTile } from '@/components/candidates/profile/CandidateFileViewer'
import { JOB_FILE_ACCEPT, useJobFiles } from '@/hooks/useJobFiles'
import { FieldHint, FieldLabel } from './_parts'

const sizeLabel = (n: number | null) =>
  n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

/**
 * The Job description step's source documents: intake notes, client briefs, an
 * old JD. Kept with the job (job_files); Gio reads their text when it drafts the
 * description and suggests the skills. Needs the job to exist (the wizard saves
 * the draft as soon as it has a title).
 */
export function JobFilesField({ jobId }: { jobId?: string | null }) {
  const { files, upload, remove, loadError } = useJobFiles(jobId)
  const [pending, setPending] = React.useState<{ key: string; name: string; size: number }[]>([])
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const disabled = !jobId

  const add = async (list: FileList | File[] | null) => {
    if (!list || disabled) return
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random()}`
      setPending((p) => [...p, { key, name: file.name, size: file.size }])
      try {
        await upload(file)
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : `Couldn't add ${file.name}`)
      } finally {
        setPending((p) => p.filter((x) => x.key !== key))
      }
    }
  }

  const onRemove = async (id: string, name: string) => {
    const ok = await confirmDestructive({
      variant: 'remove',
      title: `Remove ${name}?`,
      description: 'Gio stops using it when drafting this job. The file stays in the job’s records.',
      confirmLabel: 'Remove file',
    })
    if (!ok) return
    try {
      await remove(id)
    } catch {
      toast.error(`Couldn't remove ${name}`, { action: { label: 'Retry', onClick: () => void remove(id) } })
    }
  }

  return (
    <div>
      <FieldLabel optional>Source documents</FieldLabel>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void add(e.dataTransfer.files)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        className={cn(
          'gio-dropzone mt-2 flex items-center gap-3 rounded-[10px] px-4 py-3',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
        data-drag-over={dragOver || undefined}
        style={{
          background: dragOver ? '#F5F0FF' : '#FAFAF7',
          border: '1.5px dashed',
          borderColor: dragOver ? '#6F3FF5' : '#D1D0CB',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={JOB_FILE_ACCEPT}
          onChange={(e) => {
            void add(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: '#EDE4FF' }}>
          <UploadCloud className="h-4 w-4" style={{ color: '#6F3FF5' }} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 font-inter">
          <span className="block text-[13px]" style={{ color: '#1F2230' }}>
            {disabled ? (
              'Add a job title first; files are kept with the job'
            ) : (
              <>
                Drop files here, or <span className="font-semibold" style={{ color: '#6F3FF5' }}>browse</span>
              </>
            )}
          </span>
          <span className="block text-[11.5px]" style={{ color: '#8B8F9E' }}>
            PDF, Word or text · up to 25 MB each
          </span>
        </span>
      </div>

      {(files.length > 0 || pending.length > 0) && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5 rounded-lg border border-virgilio-border bg-white px-2.5 py-2">
              <FileTypeTile
                file={{ id: f.id, file_name: f.file_name, file_type: f.mime_type, file_size_bytes: f.size_bytes, created_at: f.created_at } as never}
                size={26}
              />
              <span className="min-w-0 flex-1 font-inter">
                <span className="block truncate text-[13px] text-text-primary">{f.file_name}</span>
                <span className="flex items-center gap-1 text-[11.5px] text-text-tertiary tabular-nums">
                  {sizeLabel(f.size_bytes)}
                  {!f.has_text && (
                    <>
                      <span aria-hidden>·</span>
                      <AlertTriangle className="h-3 w-3 text-[#B45309]" />
                      <span className="text-[#B45309]">No text found (a scanned file?). Gio can't read it.</span>
                    </>
                  )}
                </span>
              </span>
              <IconTip label={`Remove ${f.file_name}`} side="top">
                <button
                  type="button"
                  aria-label={`Remove ${f.file_name}`}
                  onClick={() => void onRemove(f.id, f.file_name)}
                  className="gio-pressable rounded-md p-1 text-text-tertiary hover:bg-[#F1F0EC] hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </IconTip>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="flex items-center gap-2.5 rounded-lg border border-dashed border-virgilio-border px-2.5 py-2 font-inter">
              <span className="gio-spinner shrink-0" style={{ width: 13, height: 13, borderWidth: 1.5 }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">{p.name}</span>
              <span className="text-[11.5px] text-text-tertiary">Reading…</span>
            </li>
          ))}
        </ul>
      )}
      {loadError ? (
        <p className="mt-2 font-inter text-[12px] text-destructive">Couldn't load this job's files.</p>
      ) : (
        <FieldHint>Intake notes, a client brief or an old JD. Gio reads them when it drafts the description and suggests skills.</FieldHint>
      )}
    </div>
  )
}
