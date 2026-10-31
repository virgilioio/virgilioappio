import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import { FileStage, Tile, fmtSize, typeOf, type PublicFile } from '@/components/public/PublicFiles'
import { supabase } from '@/lib/supabaseClient'
import type { CandidateAttachment } from '@/hooks/useCandidateAttachments'

/**
 * A candidate's file, opened from the profile's Files: the same viewer as the
 * client dossier (PDF and Word pages, the audio player, the video player,
 * images), on a short-lived signed link so a long video streams instead of
 * downloading first. Left and right arrows move between the files.
 * Files kept elsewhere (a commission invoice in Gio Sales, 2026-10-31) pass
 * `signedUrl`, which hands back their own short-lived link.
 */

/** What the viewer needs from a file. */
export type ViewerFile = Pick<CandidateAttachment, 'id' | 'file_name' | 'file_type' | 'file_size_bytes' | 'created_at' | 'file_url'>

const toPublic = (a: ViewerFile, url: string | null): PublicFile => ({
  id: a.id, name: a.file_name, type: a.file_type, size: a.file_size_bytes, created_at: a.created_at, url,
})

/** Files the viewer can show (everything else downloads). */
export function canView(a: CandidateAttachment) {
  return !!typeOf(toPublic(a, null)).viewer
}

/** The file's coloured type tile, the same one the client dossier shows. */
export function FileTypeTile({ file, size = 28 }: { file: Pick<CandidateAttachment, 'id' | 'file_name' | 'file_type' | 'file_size_bytes' | 'created_at'>; size?: number }) {
  return <Tile t={typeOf(toPublic(file as CandidateAttachment, null))} size={size} />
}

export function CandidateFileViewer<F extends ViewerFile = CandidateAttachment>({
  files,
  index,
  onIndex,
  onClose,
  onDownload,
  signedUrl,
  addedLabel = 'Added',
}: {
  files: F[]
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
  onDownload: (a: F) => void
  /** A link for files outside candidate-attachments; null when it can't be had. */
  signedUrl?: (a: F) => Promise<string | null>
  /** The word before the file's date in the header ("Issued" for an invoice). */
  addedLabel?: string
}) {
  const a = index === null ? null : files[index] ?? null
  const [url, setUrl] = useState<{ id: string; url: string | null } | null>(null)
  const [info, setInfo] = useState<Record<string, string>>({})
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!a) return
    let cancelled = false
    setUrl(null)
    const link = signedUrl
      ? signedUrl(a).catch(() => null)
      : supabase.storage
          .from('candidate-attachments')
          .createSignedUrl(a.file_url, 3600)
          .then(({ data }) => data?.signedUrl ?? null)
    link.then((u) => { if (!cancelled) setUrl({ id: a.id, url: u }) })
    return () => { cancelled = true }
  }, [a?.id, a?.file_url, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (index === null) return
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      else if (e.key === 'ArrowRight' && index < files.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [index, files.length, onIndex])

  const ready = a && url?.id === a.id
  const f = a ? toPublic(a, ready ? url!.url : null) : null
  const t = f ? typeOf(f) : null
  const added = a ? new Date(a.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100vw-32px)] max-w-[980px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:rounded-2xl"
        closeClassName="hidden"
        aria-describedby={undefined}
      >
        {a && f && t && (
          <>
            <header className="flex items-center gap-3 border-b border-[#EEEDE8] px-3.5 py-3">
              <Tile t={t} size={32} />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate font-poppins text-[14px] font-semibold text-[#0d0d09]">{a.file_name}</DialogTitle>
                <div className="truncate font-inter text-[11px] text-[#8B8F9E]">
                  {[info[a.id] || t.name, fmtSize(a.file_size_bytes), `${addedLabel} ${added}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              {files.length > 1 && (
                <div className="flex items-center gap-0.5 font-inter text-[11.5px] text-[#5A6072]">
                  <IconTip label="Previous file">
                    <Button variant="ghost" size="xs" iconOnly icon={ChevronLeft} aria-label="Previous file" disabled={index === 0} onClick={() => onIndex(index! - 1)} />
                  </IconTip>
                  <span className="tabular-nums">{index! + 1} of {files.length}</span>
                  <IconTip label="Next file">
                    <Button variant="ghost" size="xs" iconOnly icon={ChevronRight} aria-label="Next file" disabled={index === files.length - 1} onClick={() => onIndex(index! + 1)} />
                  </IconTip>
                </div>
              )}
              <Button variant="outline" size="sm" icon={Download} onClick={() => onDownload(a)}>Download</Button>
              <IconTip label="Close">
                <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close" onClick={onClose} />
              </IconTip>
            </header>
            {ready && !url!.url && signedUrl ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 bg-[#EDEBE5] px-6 text-center">
                <p className="font-inter text-[13px] text-[#5A6072]">Couldn't open this file.</p>
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
              </div>
            ) : ready ? (
              <FileStage f={f} onInfo={(id, v) => setInfo((m) => (m[id] === v ? m : { ...m, [id]: v }))} />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center bg-[#EDEBE5]">
                <span className="gio-spinner" style={{ width: 20, height: 20 }} aria-label="Loading" />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
