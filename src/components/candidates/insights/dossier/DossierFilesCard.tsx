import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, FileText, FileAudio, FileVideo, FileImage, File as FileIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DOCXResumeViewer } from '@/components/candidates/DOCXResumeViewer'

/**
 * Files card for the Gio Fit dossier — non-resume attachments only.
 * View-only: files open in an in-app viewer, no download controls.
 */

interface FileRow {
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

const ICONS: Record<Kind, typeof FileIcon> = {
  pdf: FileText, docx: FileText, text: FileText, image: FileImage, audio: FileAudio, video: FileVideo, other: FileIcon,
}

function size(bytes?: number | null) {
  if (!bytes) return null
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`
}

export function DossierFilesCard({ candidateId, className, headingClassName }: { candidateId: string; className: string; headingClassName: string }) {
  const [open, setOpen] = useState<FileRow | null>(null)
  const { data: files = [] } = useQuery({
    queryKey: ['dossier-files', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_attachments')
        .select('id, file_name, file_url, file_type, file_size_bytes, created_at')
        .eq('candidate_id', candidateId)
        .eq('is_resume', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as FileRow[]
    },
  })

  if (!files.length) return null

  return (
    <section className={className}>
      <div className="border-b border-fit-hairline px-4 py-4">
        <h3 className={headingClassName}><Paperclip className="h-3 w-3" /> Files</h3>
      </div>
      <div className="divide-y divide-fit-hairline">
        {files.map((f) => {
          const Icon = ICONS[kindOf(f)]
          const meta = [size(f.file_size_bytes), new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' · ')
          return (
            <button key={f.id} type="button" onClick={() => setOpen(f)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#FAFAF7]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1F0EC] text-[#5A6072]"><Icon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-inter text-[12.5px] font-medium text-fit-ink">{f.file_name}</span>
                <span className="block font-inter text-[10.5px] text-fit-subtle">{meta}</span>
              </span>
            </button>
          )
        })}
      </div>
      <FileViewer file={open} onClose={() => setOpen(null)} />
    </section>
  )
}

function FileViewer({ file, onClose }: { file: FileRow | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const kind = file ? kindOf(file) : 'other'

  useEffect(() => {
    let objectUrl: string | null = null
    setUrl(null); setText(null); setError(null)
    if (!file) return
    ;(async () => {
      const { data, error } = await supabase.storage.from('candidate-attachments').download(file.file_url)
      if (error || !data) { setError('This file could not be opened.'); return }
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
          <iframe src={`${url}#toolbar=0&navpanes=0`} title={file?.file_name} className="h-[70vh] w-full rounded-md border" />
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
