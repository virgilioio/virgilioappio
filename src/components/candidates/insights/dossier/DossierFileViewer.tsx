import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DOCXResumeViewer } from '@/components/candidates/DOCXResumeViewer'
import { PDFResumeViewer } from '@/components/candidates/PDFResumeViewer'

/**
 * Files card for the Gio Fit dossier — non-resume attachments only.
 * View-only: files open in an in-app viewer, no download controls.
 */

export interface FileRow {
  signed_url?: string | null
  id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size_bytes: number | null
  created_at: string
}

type Kind = 'pdf' | 'image' | 'audio' | 'video' | 'docx' | 'text' | 'other'

function kindOf(f: FileRow): Kind {
  const t = f.file_type || ''
  const n = f.file_name.toLowerCase()
  if (t.includes('pdf') || n.endsWith('.pdf')) return 'pdf'
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|webm)$/.test(n)) return 'audio'
  if (t.startsWith('video/') || /\.(mp4|mov)$/.test(n)) return 'video'
  if (t.includes('wordprocessingml') || n.endsWith('.docx')) return 'docx'
  if (t.startsWith('text/')) return 'text'
  return 'other'
}

export function FileViewer({ file, onClose }: { file: FileRow | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const kind = file ? kindOf(file) : 'other'

  useEffect(() => {
    let objectUrl: string | null = null
    setUrl(null); setText(null); setError(null)
    if (!file) return
    ;(async () => {
      let data: Blob | null = null
      if (file.signed_url) {
        const res = await fetch(file.signed_url).catch(() => null)
        data = res && res.ok ? await res.blob() : null
      } else {
        const r = await supabase.storage.from('candidate-attachments').download(file.file_url)
        data = r.error ? null : r.data
      }
      if (!data) { setError('This file could not be opened.'); return }
      const typed = file.file_type ? new Blob([data], { type: file.file_type }) : data
      if (kind === 'text') setText(await typed.text())
      objectUrl = URL.createObjectURL(typed)
      setUrl(objectUrl)
    })()
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [file?.id])

  const block = (e: React.SyntheticEvent) => e.preventDefault()

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl" onContextMenu={block}>
        <DialogHeader><DialogTitle className="truncate pr-8">{file?.file_name}</DialogTitle></DialogHeader>
        {error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>
        ) : !url ? (
          <div className="flex h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : kind === 'pdf' ? (
          <div className="max-h-[70vh] overflow-auto rounded-md border"><PDFResumeViewer url={url} height={70} /></div>
        ) : kind === 'image' ? (
          <img src={url} alt={file?.file_name} className="mx-auto max-h-[70vh] rounded-md object-contain" draggable={false} />
        ) : kind === 'audio' ? (
          <div className="py-10"><audio src={url} controls controlsList="nodownload noplaybackrate" className="w-full" autoPlay /></div>
        ) : kind === 'video' ? (
          <video src={url} controls controlsList="nodownload" disablePictureInPicture className="max-h-[70vh] w-full rounded-md" />
        ) : kind === 'docx' ? (
          <div className="rounded-md border"><DOCXResumeViewer url={url} /></div>
        ) : kind === 'text' ? (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-[12.5px]">{text}</pre>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">This file type can’t be previewed in the browser.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
