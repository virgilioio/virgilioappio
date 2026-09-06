import { ReactNode, useRef, useState } from 'react'
import { Info, Mail, Sparkles, UploadCloud, Loader2 } from 'lucide-react'
import { ProfileCard } from './primitives/ProfileCard'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shared Resume tab card — identical on the independent and in-job profiles.
 * Presentation only: every handler is supplied by the caller.
 */

interface ResumeDropSlotProps {
  parsing?: boolean
  disabled?: boolean
  accept?: string
  onFile: (file: File) => void
}

/** The intake area — idle and parsing renderings of the canonical dropzone. */
export function ResumeDropSlot({ parsing, disabled, accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg', onFile }: ResumeDropSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  if (parsing) {
    return (
      <div className="rounded-[10px] border-[1.5px] border-dashed border-[#D1D0CB] bg-[#FAFAF7] px-4 py-5 text-center">
        <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EDE4FF] text-[#6F3FF5]">
          <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={1.85} />
        </div>
        <p className="font-inter text-[12.5px] font-medium text-[#1F2230]">Gio is reading the file…</p>
        <p className="mt-1 font-inter text-[10.5px] text-[#8B8F9E]">
          Contact info, skills and experience are being extracted
        </p>
      </div>
    )
  }

  return (
    <div
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && !disabled) onFile(file)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      className={cn(
        'cursor-pointer rounded-[10px] border-[1.5px] border-dashed bg-[#FAFAF7] px-4 py-5 text-center transition-colors',
        dragOver ? 'border-[#6F3FF5] bg-[#FAF8FF]' : 'border-[#D1D0CB] hover:border-[#6F3FF5]/60',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.currentTarget.value = ''
        }}
      />
      <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EDE4FF] text-[#6F3FF5]">
        <UploadCloud className="h-[18px] w-[18px]" strokeWidth={1.85} />
      </div>
      <p className="font-inter text-[12.5px] font-medium text-[#1F2230]">
        Drop resume here, or <span className="text-[#6F3FF5]">browse</span>
      </p>
      <p className="mt-1 font-inter text-[10.5px] text-[#8B8F9E]">
        PDF, DOCX, or image · up to 10 MB · Gio will parse contact info, skills, and experience
      </p>
    </div>
  )
}

/** Dashed placeholder row for the sidebar Files block when no resume exists. */
export function NoResumeFileSlot() {
  return (
    <div className="mb-1.5 flex items-center gap-[9px] rounded-[9px] border border-dashed border-[#D1D0CB] bg-[#FAFAF7] px-2.5 py-[9px]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1F0EC] text-[#8B8F9E]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v5h5M8 13h8M8 17h5" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="font-inter text-[12px] font-medium text-[#5A6072]">No resume</div>
        <div className="mt-px font-inter text-[10.5px] text-[#8B8F9E]">Upload one to enrich this profile</div>
      </div>
    </div>
  )
}

export interface ResumeTabCardProps {
  candidateId: string
  resumeOnFile: boolean
  fileName?: string | null
  uploadedBy?: string | null
  uploadedDate?: string | null
  fallbackResumeUrl?: string | null
  /** File is uploading or Gio is reading it. */
  parsing?: boolean
  onFile: (file: File) => void
  /** Ghost action shown in the empty-state header. */
  onAskCandidate?: () => void
  /** Extra ghost actions for the viewer header (Replace, Delete…). */
  viewerActions?: ReactNode
}

export function ResumeTabCard({
  candidateId,
  resumeOnFile,
  fileName,
  uploadedBy,
  uploadedDate,
  fallbackResumeUrl,
  parsing,
  onFile,
  onAskCandidate,
  viewerActions,
}: ResumeTabCardProps) {
  if (!resumeOnFile) {
    return (
      <ProfileCard
        title="Resume"
        subtitle={parsing ? 'Uploading · Gio is reading the file' : 'No resume on file'}
        action={
          !parsing && onAskCandidate ? (
            <Button variant="ghost" size="sm" icon={Mail} onClick={onAskCandidate}>
              Ask candidate for it
            </Button>
          ) : undefined
        }
      >
        <ResumeDropSlot parsing={parsing} onFile={onFile} />
        <div className="mt-2.5 flex items-start gap-2 font-inter text-[11.5px] leading-[1.5] text-[#8B8F9E]">
          <Info className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
          <span>
            A resume lets Gio fill in contact details, skills, work history and education automatically. You can always
            edit anything it extracts.
          </span>
        </div>
      </ProfileCard>
    )
  }

  const subtitleParts = [fileName || 'Resume', uploadedBy ? `uploaded by ${uploadedBy}` : 'uploaded', uploadedDate]
    .filter(Boolean)

  return (
    <ProfileCard
      title="Resume"
      subtitle={
        subtitleParts.length > 1
          ? `${subtitleParts[0]} · ${subtitleParts.slice(1).join(' on ')}`
          : subtitleParts[0]
      }
      badge={
        parsing ? (
          <Badge tone="lilac" size="xs" icon={Sparkles} pulse>Gio is reading this resume</Badge>
        ) : (
          <Badge tone="lilac" size="xs" icon={Sparkles}>Parsed by Gio</Badge>
        )
      }
      action={viewerActions}
      bodyPadding="none"
    >
      <CandidateResumeViewer candidateId={candidateId} fallbackResumeUrl={fallbackResumeUrl} />
    </ProfileCard>
  )
}

export default ResumeTabCard
