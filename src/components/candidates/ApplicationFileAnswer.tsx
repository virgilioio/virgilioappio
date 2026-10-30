import { useState } from 'react'
import { Download, Play, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CandidateFileViewer, FileTypeTile, canView } from '@/components/candidates/profile/CandidateFileViewer'
import { fmtSize } from '@/components/public/PublicFiles'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { readMediaAnswer } from '@/lib/applicationMedia'

/**
 * An Audio, Video or File upload answer from an application: the file's tile,
 * its name and size, and Listen / Watch / View, which opens the same viewer as
 * the candidate's Files. The answer points at the candidate's file, so a file
 * removed from the profile reads as removed here too.
 */
export function ApplicationFileAnswer({ candidateId, value }: { candidateId: string; value: string | null }) {
  const answer = readMediaAnswer(value)
  const { attachments, isLoading, downloadAttachment } = useCandidateAttachments(candidateId)
  const [open, setOpen] = useState(false)
  if (!answer) return <span>Not provided</span>
  const file = attachments.find((a) => a.id === answer.attachment_id) ?? null
  if (!file) {
    return <span className="text-text-tertiary">{isLoading ? 'Loading…' : `${answer.name} (no longer in their files)`}</span>
  }
  const viewable = canView(file)
  const kind = (file.file_type || '').startsWith('audio/') || answer.kind === 'audio'
    ? 'audio'
    : (file.file_type || '').startsWith('video/') || answer.kind === 'video'
      ? 'video'
      : 'file'
  const verb = kind === 'audio' ? 'Listen' : kind === 'video' ? 'Watch' : 'View'
  return (
    <div className="flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3 py-2.5">
      <FileTypeTile file={file} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-inter text-[13px] font-medium text-text-primary">{file.file_name}</div>
        <div className="font-inter text-[12px] tabular-nums text-text-tertiary">{fmtSize(file.file_size_bytes)}</div>
      </div>
      {viewable ? (
        <Button variant="secondary" size="sm" icon={kind === 'file' ? ExternalLink : Play} onClick={() => setOpen(true)}>
          {verb}
        </Button>
      ) : (
        <Button variant="secondary" size="sm" icon={Download} onClick={() => void downloadAttachment(file.id, file.file_name)}>
          Download
        </Button>
      )}
      <CandidateFileViewer
        files={[file]}
        index={open ? 0 : null}
        onIndex={() => {}}
        onClose={() => setOpen(false)}
        onDownload={(a) => void downloadAttachment(a.id, a.file_name)}
      />
    </div>
  )
}
