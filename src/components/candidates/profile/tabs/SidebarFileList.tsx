import type { ReactNode } from 'react'
import { useState } from 'react'
import { FileText, FileAudio, FileVideo, FileImage, FileArchive, File as FileIcon, MoreHorizontal, Eye, Download, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { IconTip } from '@/components/ui/tooltip'
import { collapseRows, rowsById } from '@/lib/motion'
import { AttachmentPreviewDialog } from '@/components/candidates/AttachmentPreviewDialog'
import type { CandidateAttachment } from '@/hooks/useCandidateAttachments'

const PREVIEWABLE = /pdf|image\/|word|officedocument|text\/plain/

function iconFor(type?: string | null, name?: string) {
  const t = type || ''
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(name || '')) return FileAudio
  if (t.startsWith('video/')) return FileVideo
  if (t.startsWith('image/')) return FileImage
  if (/zip|compressed/.test(t)) return FileArchive
  if (/pdf|word|text/.test(t)) return FileText
  return FileIcon
}

function size(bytes?: number | null) {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  attachments: CandidateAttachment[]
  uploading: string[]
  canDelete: boolean
  onDownload: (id: string, name: string) => void
  onDelete: (id: string, url: string) => Promise<void>
  /** Shown instead of the resume row's meta while a new resume goes in (ResumeStatusLine). */
  resumeStatus?: ReactNode
}

export function SidebarFileList({ attachments, uploading, canDelete, onDownload, onDelete, resumeStatus }: Props) {
  const [preview, setPreview] = useState<CandidateAttachment | null>(null)
  const sorted = [...attachments].sort((a, b) =>
    a.is_resume === b.is_resume ? b.created_at.localeCompare(a.created_at) : a.is_resume ? -1 : 1,
  )
  // C18 (Block B §16, Pattern 1): name the file; the row collapses once confirmed.
  const confirmDelete = async (a: CandidateAttachment) => {
    const ok = await confirmDestructive({
      title: `Delete \u201c${a.file_name}\u201d?`,
      description: a.is_resume
        ? 'It\u2019s the résumé on file, and it\u2019s deleted for everyone. The details read from it stay on the profile. This can\u2019t be undone.'
        : 'The file is deleted from this candidate for everyone. Their other files stay. This can\u2019t be undone.',
      confirmLabel: 'Delete file',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([a.id]))
    await exit.done
    try {
      await onDelete(a.id, a.file_url)
    } catch {
      exit.revert() // the hook already said it couldn't delete
    }
  }

  if (!sorted.length && !uploading.length) return null

  return (
    <>
      {uploading.map((n) => (
        <div key={`up-${n}`} className="flex items-center gap-[9px] rounded-[9px] border border-[#E7E5DF] px-2.5 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#6F3FF5]" />
          <span className="truncate font-inter text-[12px] text-[#5A6072]">{n}</span>
        </div>
      ))}
      {sorted.map((a) => {
        const Icon = iconFor(a.file_type, a.file_name)
        const canPreview = PREVIEWABLE.test(a.file_type || '')
        const meta = [size(a.file_size_bytes), new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' · ')
        return (
          <div key={a.id} data-row-id={a.id} className="group flex items-center gap-[9px] rounded-[9px] border border-[#E7E5DF] px-2.5 py-2 hover:bg-[#FAFAF7]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1F0EC] text-[#5A6072]">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => (canPreview ? setPreview(a) : onDownload(a.id, a.file_name))}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate font-inter text-[12px] font-medium text-[#1F2230]">{a.file_name}</span>
                {a.is_resume && <Badge tone="lilac" size="xs">Resume</Badge>}
              </div>
              {a.is_resume && resumeStatus ? (
                <div className="mt-px min-w-0">{resumeStatus}</div>
              ) : (
                <div className="mt-px font-inter text-[10.5px] text-[#8B8F9E]">{meta}</div>
              )}
            </button>
            <DropdownMenu>
              <IconTip label="File actions">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="File actions" />
                </DropdownMenuTrigger>
              </IconTip>
              <DropdownMenuContent align="end" sideOffset={8}>
                {canPreview && (
                  <DropdownMenuItem onClick={() => setPreview(a)}><Eye className="h-3.5 w-3.5" />Preview</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDownload(a.id, a.file_name)}><Download className="h-3.5 w-3.5" />Download</DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => void confirmDelete(a)}>
                      <Trash2 className="h-3.5 w-3.5" />Delete file
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}

      <AttachmentPreviewDialog
        attachment={preview}
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        onDownload={() => preview && onDownload(preview.id, preview.file_name)}
      />
    </>
  )
}
