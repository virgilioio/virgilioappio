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
 */

const toPublic = (a: CandidateAttachment, url: string | null): PublicFile => ({
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

export function CandidateFileViewer({
  files,
  index,
  onIndex,
  onClose,
  onDownload,
}: {
  files: CandidateAttachment[]
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
  onDownload: (a: CandidateAttachment) => void
}) {
  const a = index === null ? null : files[index] ?? null
  const [url, setUrl] = useState<{ id: string; url: string | null } | null>(null)
  const [info, setInfo] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!a) return
    let cancelled = false
    setUrl(null)
    supabase.storage
      .from('candidate-attachments')
      .createSignedUrl(a.file_url, 3600)
      .then(({ data }) => { if (!cancelled) setUrl({ id: a.id, url: data?.signedUrl ?? null }) })
    return () => { cancelled = true }
  }, [a?.id, a?.file_url]) // eslint-disable-line react-hooks/exhaustive-deps

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
                  {[info[a.id] || t.name, fmtSize(a.file_size_bytes), `Added ${added}`].filter(Boolean).join(' · ')}
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
            {ready ? (
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
