/**
 * Public dossier Files card + modal viewer.
 * Files arrive only through the share-token payload as short-lived signed URLs.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  AudioLines, ChevronLeft, ChevronRight, Clapperboard, Download, ExternalLink, File, FileArchive, FileSpreadsheet,
  FileText, FileType2, Image as ImageIcon, Maximize, Minus, Paperclip, Pause, Play, Plus,
  RotateCcw, RotateCw, X, type LucideIcon,
} from 'lucide-react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export interface PublicFile {
  id: string
  name: string
  type: string | null
  size: number | null
  created_at: string
  url: string | null
  label?: string | null
}

type Viewer = 'document' | 'audio' | 'video' | 'image' | null
interface TypeDef { key: string; name: string; Icon: LucideIcon; fg: string; bg: string; verb: string; verbIcon: LucideIcon | null; viewer: Viewer }

const TYPES: Record<string, TypeDef> = {
  pdf: { key: 'pdf', name: 'PDF document', Icon: FileText, fg: '#C4320A', bg: '#FEF0E7', verb: 'View', verbIcon: ExternalLink, viewer: 'document' },
  word: { key: 'word', name: 'Word document', Icon: FileType2, fg: '#1D4ED8', bg: '#EAF1FE', verb: 'View', verbIcon: ExternalLink, viewer: 'document' },
  audio: { key: 'audio', name: 'Audio', Icon: AudioLines, fg: '#6F3FF5', bg: '#F1ECFE', verb: 'Listen', verbIcon: Play, viewer: 'audio' },
  video: { key: 'video', name: 'Video', Icon: Clapperboard, fg: '#BE185D', bg: '#FCE7F3', verb: 'Watch', verbIcon: Play, viewer: 'video' },
  image: { key: 'image', name: 'Image', Icon: ImageIcon, fg: '#0E8A65', bg: '#E7F7F1', verb: 'View', verbIcon: ExternalLink, viewer: 'image' },
  sheet: { key: 'sheet', name: 'Spreadsheet', Icon: FileSpreadsheet, fg: '#15803D', bg: '#EAF6EE', verb: '', verbIcon: null, viewer: null },
  archive: { key: 'archive', name: 'Archive', Icon: FileArchive, fg: '#B45309', bg: '#FEF3C7', verb: '', verbIcon: null, viewer: null },
  other: { key: 'other', name: 'File', Icon: File, fg: '#5A6072', bg: '#F1F0EC', verb: '', verbIcon: null, viewer: null },
}

/** A type's tile colours and icon by key (audio, video, pdf, word, image, other…). */
export function fileTypeFor(key: string): TypeDef {
  return TYPES[key] ?? TYPES.other
}

const EXT: Record<string, string> = {
  pdf: 'pdf', doc: 'word', docx: 'word',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', aac: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet',
  zip: 'archive', rar: 'archive', '7z': 'archive',
}

const extOf = (n: string) => (n.split('.').pop() || '').toLowerCase()
export function typeOf(f: PublicFile): TypeDef {
  const byExt = EXT[extOf(f.name)]
  if (byExt) return TYPES[byExt]
  const t = f.type || ''
  if (t.includes('pdf')) return TYPES.pdf
  if (t.startsWith('audio/')) return TYPES.audio
  if (t.startsWith('video/')) return TYPES.video
  if (t.startsWith('image/')) return TYPES.image
  if (/word|officedocument\.wordprocessing/.test(t)) return TYPES.word
  if (/zip|compressed/.test(t)) return TYPES.archive
  return TYPES.other
}
export const fmtSize = (b: number | null) => (!b ? '' : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`)
const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
export const downloadUrl = (f: PublicFile) => (f.url ? `${f.url}${f.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(f.name)}` : '#')

export function Tile({ t, size = 36, ext }: { t: TypeDef; size?: number; ext?: string }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: size / 4, background: t.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <t.Icon size={Math.round(size * 0.44)} color={t.fg} />
      {ext && (
        <span style={{ position: 'absolute', right: -6, bottom: -4, background: '#fff', border: '1px solid #E7E8EE', borderRadius: 4, padding: '0 3px', fontSize: 8, fontWeight: 700, lineHeight: '12px', color: t.fg, fontFamily: 'Inter, sans-serif' }}>
          {ext.toUpperCase()}
        </span>
      )}
    </span>
  )
}

/* ---------------- Card ---------------- */

export function PublicFilesCard({ files }: { files: PublicFile[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  // The last file opened stays in the dialog while it leaves.
  const [shownIdx, setShownIdx] = useState(0)
  const [meta, setMeta] = useState<Record<string, string>>({})
  if (!files.length) return null
  const previewable = files.map((f, i) => ({ f, i })).filter(({ f }) => typeOf(f).viewer)
  const setInfo = (id: string, v: string) => setMeta((m) => (m[id] === v ? m : { ...m, [id]: v }))

  return (
    <section style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8B8F9E' }}>
        <Paperclip size={11} /> Files
        <span style={{ marginLeft: 'auto', letterSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>{files.length}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {files.map((f, i) => (
          <FileRowItem key={f.id} f={f} info={meta[f.id]} onOpen={() => { if (!typeOf(f).viewer) { window.open(downloadUrl(f), '_self'); return } setOpenIdx(i); setShownIdx(i) }} />
        ))}
      </div>
      {previewable.length > 0 && (
        <FileModal
          open={openIdx !== null}
          files={previewable.map((p) => p.f)}
          index={Math.max(0, previewable.findIndex((p) => p.i === (openIdx ?? shownIdx)))}
          onIndex={(k) => { setOpenIdx(previewable[k].i); setShownIdx(previewable[k].i) }}
          onClose={() => setOpenIdx(null)}
          onInfo={setInfo}
        />
      )}
    </section>
  )
}

function FileRowItem({ f, info, onOpen }: { f: PublicFile; info?: string; onOpen: () => void }) {
  const t = typeOf(f)
  const primary = f.label?.trim() || f.name
  const parts = [f.label?.trim() ? f.name : null, info || t.name, fmtSize(f.size) || null].filter(Boolean)
  const VI = t.verbIcon
  return (
    <button
      type="button" onClick={onOpen}
      className="group gio-pressable font-inter hover:bg-[#FBFAF7]"
      style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 8px', margin: '0 -8px', boxSizing: 'content-box', border: 0, borderRadius: 10, textAlign: 'left', cursor: 'pointer' }}
    >
      <Tile t={t} ext={extOf(f.name)} />
      <span style={{ minWidth: 0, flex: 1, marginLeft: 4 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#1F2230', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</span>
        <span style={{ display: 'block', fontSize: 11, color: '#8B8F9E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts.join(' · ')}</span>
      </span>
      <span className="text-[#8B8F9E] group-hover:text-[#6F3FF5]" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 500, flexShrink: 0 }}>
        {VI ? (<>{t.verb} <VI size={12} /></>) : <Download size={14} aria-label="Download" />}
      </span>
    </button>
  )
}

/* ---------------- Modal ---------------- */

const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1F2230' }
const ICON_BTN = 'gio-pressable bg-transparent hover:bg-[#F1F0EC] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent'
const ICON_BTN_DARK = 'gio-pressable bg-transparent hover:bg-white/10'

/** An icon-only control: IconTip with the same words as its label, never a native title. */
function IconButton({ label, side, dark, style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; side?: 'top' | 'bottom'; dark?: boolean }) {
  return (
    <IconTip label={label} side={side}>
      <button type="button" aria-label={label} className={dark ? ICON_BTN_DARK : ICON_BTN} style={{ ...iconBtn, ...(dark ? { color: '#fffcf9' } : null), ...style }} {...props} />
    </IconTip>
  )
}

function FileModal({ open, files, index, onIndex, onClose, onInfo }: { open: boolean; files: PublicFile[]; index: number; onIndex: (i: number) => void; onClose: () => void; onInfo: (id: string, v: string) => void }) {
  const f = files[index]
  const t = typeOf(f)
  const go = useCallback((d: number) => { const n = index + d; if (n >= 0 && n < files.length) onIndex(n) }, [index, files.length, onIndex])
  const panel = useRef<HTMLDivElement>(null)

  // Left and right move between files; Esc, focus and scroll lock are the Dialog's.
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, go])

  const added = new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        closeClassName="hidden"
        ref={panel}
        // Focus the viewer itself, not its first button: a focused icon button would
        // open its tooltip on arrival, and Esc would close that before the viewer.
        onOpenAutoFocus={(e) => { e.preventDefault(); panel.current?.focus() }}
        onContextMenu={(e) => e.preventDefault()}
        className="flex max-h-[92vh] w-[calc(100vw-32px)] max-w-[980px] flex-col gap-0 overflow-hidden rounded-2xl p-0 font-inter sm:rounded-2xl"
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid #EEEDE8' }}>
          <Tile t={t} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <DialogTitle className="truncate font-poppins" style={{ fontSize: 14, fontWeight: 600, color: '#0d0d09', lineHeight: 1.4 }}>{f.label?.trim() || f.name}</DialogTitle>
            <div style={{ fontSize: 11, color: '#8B8F9E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[f.name, fmtSize(f.size), `Added ${added}`].filter(Boolean).join(' · ')}</div>
          </div>
          {files.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11.5, color: '#5A6072' }}>
              <IconButton label="Previous file" disabled={index === 0} onClick={() => go(-1)}><ChevronLeft size={15} /></IconButton>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{index + 1} of {files.length}</span>
              <IconButton label="Next file" disabled={index === files.length - 1} onClick={() => go(1)}><ChevronRight size={15} /></IconButton>
            </div>
          )}
          <span style={{ width: 1, height: 20, background: '#E7E8EE' }} />
          <a href={downloadUrl(f)} className="gio-pressable whitespace-nowrap hover:bg-[#FBFAF7]" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid #E7E8EE', fontSize: 12, fontWeight: 500, color: '#1F2230', textDecoration: 'none' }}>
            <Download size={13} /> Download
          </a>
          <IconButton label="Close" onClick={onClose}><X size={16} /></IconButton>
        </header>
        <FileStage f={f} onInfo={onInfo} />
      </DialogContent>
    </Dialog>
  )
}

/** The viewer itself: PDF and Word pages, the audio waveform player, the video
 *  player or the image. Shared by the client dossier and the candidate profile. */
export function FileStage({ f, onInfo }: { f: PublicFile; onInfo: (id: string, v: string) => void }) {
  const t = typeOf(f)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {!f.url ? <NoPreview f={f} /> :
        t.viewer === 'document' ? <DocViewer key={f.id} f={f} word={t.key === 'word'} onPages={(n) => onInfo(f.id, `${n} ${n === 1 ? 'page' : 'pages'}`)} /> :
        t.viewer === 'audio' ? <AudioViewer key={f.id} url={f.url} onDuration={(d) => onInfo(f.id, fmtTime(d))} /> :
        t.viewer === 'video' ? <VideoViewer key={f.id} url={f.url} onDuration={(d) => onInfo(f.id, fmtTime(d))} /> :
        t.viewer === 'image' ? (
          <div style={{ background: '#EDEBE5', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 360 }}>
            <img src={f.url} alt={f.name} draggable={false} style={{ maxWidth: '100%', maxHeight: '74vh', objectFit: 'contain' }} />
          </div>
        ) : <NoPreview f={f} />}
    </div>
  )
}

function NoPreview({ f }: { f: PublicFile }) {
  const t = typeOf(f)
  return (
    <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <Tile t={t} size={52} />
      <div className="font-poppins" style={{ fontSize: 14, fontWeight: 600, color: '#0d0d09' }}>This file can't be previewed here</div>
      <div style={{ fontSize: 12, color: '#8B8F9E' }}>Download it to open it with an app on your device.</div>
      <a href={downloadUrl(f)} style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, background: '#0d0d09', color: '#fffcf9', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
        <Download size={14} /> Download {extOf(f.name).toUpperCase() || 'file'}
      </a>
    </div>
  )
}

/* ---------------- Document ---------------- */

function DocViewer({ f, word, onPages }: { f: PublicFile; word: boolean; onPages: (n: number) => void }) {
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (word) return
    let cancelled = false
    pdfjsLib.getDocument({ url: f.url!, disableAutoFetch: true }).promise
      .then((d) => { if (!cancelled) { setDoc(d); onPages(d.numPages) } })
      .catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.url, word])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const sheets = Array.from(el.querySelectorAll<HTMLElement>('[data-page]'))
    const mid = el.scrollTop + el.clientHeight / 3
    let cur = 1
    for (const s of sheets) if (s.offsetTop <= mid) cur = Number(s.dataset.page)
    setPage(cur)
  }

  if (word || failed) {
    return (
      <div style={{ padding: 16, background: '#EDEBE5', flex: 1 }}>
        {word && <p style={{ fontSize: 11.5, color: '#5A6072', margin: '0 0 10px' }}>Shown as a preview — download for the original.</p>}
        {word ? (
          <iframe title={f.name} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(f.url!)}`} style={{ width: '100%', height: '70vh', border: 0, background: '#fff' }} />
        ) : <NoPreview f={f} />}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', background: '#FBFAF7', borderBottom: '1px solid #EEEDE8', fontSize: 11.5, color: '#5A6072' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{doc ? `Page ${page} of ${doc.numPages}` : 'Loading…'}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <IconButton label="Zoom out" style={{ width: 26, height: 26 }} disabled={zoom <= 60} onClick={() => setZoom((z) => Math.max(60, z - 20))}><Minus size={13} /></IconButton>
          <span style={{ width: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{zoom}%</span>
          <IconButton label="Zoom in" style={{ width: 26, height: 26 }} disabled={zoom >= 180} onClick={() => setZoom((z) => Math.min(180, z + 20))}><Plus size={13} /></IconButton>
        </span>
      </div>
      <div ref={scroller} onScroll={onScroll} style={{ flex: 1, minHeight: 360, maxHeight: '74vh', overflow: 'auto', background: '#EDEBE5', padding: 20, position: 'relative' }}>
        {!doc ? (
          <PageSkeleton zoom={zoom} />
        ) : Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} zoom={zoom} />)}
      </div>
    </>
  )
}

/** A blank page the size of the first one while the PDF opens (§6: never a lone spinner). */
function PageSkeleton({ zoom }: { zoom: number }) {
  return (
    <div aria-busy="true" aria-label="Loading the document" style={{ width: `min(100%, ${Math.round(612 * 1.25 * zoom / 100)}px)`, aspectRatio: '8.5 / 11', margin: '0 auto 16px', background: '#fff', boxShadow: '0 2px 10px rgba(13,13,9,0.12)', padding: '9% 10%' }}>
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <div className="mt-8 grid gap-2.5">
        {[100, 96, 92, 98, 70].map((w, i) => <Skeleton key={i} className="h-2.5" style={{ width: `${w}%` }} />)}
      </div>
      <div className="mt-6 grid gap-2.5">
        {[94, 99, 88, 60].map((w, i) => <Skeleton key={i} className="h-2.5" style={{ width: `${w}%` }} />)}
      </div>
    </div>
  )
}

function PdfPage({ doc, n, zoom }: { doc: pdfjsLib.PDFDocumentProxy; n: number; zoom: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let task: { cancel: () => void } | null = null
    doc.getPage(n).then((p) => {
      const c = canvas.current
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      const vp = p.getViewport({ scale: (zoom / 100) * 1.25 })
      c.width = vp.width * dpr; c.height = vp.height * dpr
      c.style.width = `${vp.width}px`; c.style.height = `${vp.height}px`
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const r = p.render({ canvasContext: ctx, viewport: vp })
      task = r
      r.promise.catch(() => {})
    })
    return () => task?.cancel()
  }, [doc, n, zoom])
  return (
    <div data-page={n} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
      <canvas ref={canvas} style={{ background: '#fff', boxShadow: '0 2px 10px rgba(13,13,9,0.12)', maxWidth: 'none' }} />
    </div>
  )
}

/* ---------------- Audio ---------------- */

const SPEEDS = [1, 1.25, 1.5, 2]
const speedChip: React.CSSProperties = { height: 26, minWidth: 44, padding: '0 8px', borderRadius: 999, border: '1px solid #E7E8EE', background: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }

function useMedia(ref: React.RefObject<HTMLMediaElement>, onDuration: (d: number) => void) {
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const t = () => setTime(m.currentTime)
    const d = () => { if (isFinite(m.duration)) { setDur(m.duration); onDuration(m.duration) } }
    const p = () => setPlaying(!m.paused)
    m.addEventListener('timeupdate', t); m.addEventListener('loadedmetadata', d); m.addEventListener('play', p); m.addEventListener('pause', p)
    return () => { m.removeEventListener('timeupdate', t); m.removeEventListener('loadedmetadata', d); m.removeEventListener('play', p); m.removeEventListener('pause', p) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggle = () => { const m = ref.current; if (m) (m.paused ? m.play().catch(() => {}) : m.pause()) }
  const seek = (s: number) => { const m = ref.current; if (m) m.currentTime = Math.max(0, Math.min(dur || 0, s)) }
  const cycle = () => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(n); if (ref.current) ref.current.playbackRate = n }
  return { time, dur, playing, speed, toggle, seek, cycle }
}

function AudioViewer({ url, onDuration }: { url: string; onDuration: (d: number) => void }) {
  const audio = useRef<HTMLAudioElement>(null)
  const { time, dur, playing, speed, toggle, seek, cycle } = useMedia(audio, onDuration)
  const [peaks, setPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer()
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const data = (await ctx.decodeAudioData(buf)).getChannelData(0)
        ctx.close()
        const N = 120, step = Math.floor(data.length / N) || 1, out: number[] = []
        for (let i = 0; i < N; i++) {
          let max = 0
          for (let j = i * step; j < (i + 1) * step && j < data.length; j += 32) max = Math.max(max, Math.abs(data[j]))
          out.push(max)
        }
        const top = Math.max(...out) || 1
        if (!cancelled) setPeaks(out.map((v) => v / top))
      } catch { /* flat fallback */ }
    })()
    return () => { cancelled = true }
  }, [url])

  const bars = peaks ?? Array(120).fill(0.12)
  const progress = dur ? time / dur : 0
  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    seek(((e.clientX - r.left) / r.width) * dur)
  }

  return (
    <div style={{ padding: '40px 32px 32px' }}>
      <audio ref={audio} src={url} preload="metadata" style={{ display: 'none' }} />
      <div onClick={onSeek} style={{ position: 'relative', height: 72, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
        {bars.map((v, i) => (
          <span key={i} style={{ flex: 1, height: `${Math.max(6, v * 100)}%`, borderRadius: 2, background: i / bars.length < progress ? '#6F3FF5' : '#DCD6EA' }} />
        ))}
        <span style={{ position: 'absolute', top: -4, bottom: -4, left: `${progress * 100}%`, width: 2, background: '#0d0d09', borderRadius: 1 }} />
      </div>
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <span style={{ fontSize: 12, color: '#5A6072', fontVariantNumeric: 'tabular-nums', minWidth: 96 }}>{fmtTime(time)} / {fmtTime(dur)}</span>
        <IconButton label="Back 15 seconds" onClick={() => seek(time - 15)}><RotateCcw size={17} /></IconButton>
        <IconTip label={playing ? 'Pause' : 'Play'}>
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="gio-pressable" style={{ width: 48, height: 48, borderRadius: 999, border: 0, background: '#0d0d09', color: '#fffcf9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
        </IconTip>
        <IconButton label="Forward 15 seconds" onClick={() => seek(time + 15)}><RotateCw size={17} /></IconButton>
        <span style={{ minWidth: 96 }}><button type="button" aria-label={`Speed ${speed}×`} className="gio-pressable" style={speedChip} onClick={cycle}>{speed}×</button></span>
      </div>
    </div>
  )
}

/* ---------------- Video ---------------- */

function VideoViewer({ url, onDuration }: { url: string; onDuration: (d: number) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const { time, dur, playing, speed, toggle, seek, cycle } = useMedia(video, onDuration)
  const pct = dur ? (time / dur) * 100 : 0
  return (
    <div ref={stage} style={{ background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div onClick={toggle} style={{ position: 'relative', aspectRatio: '16 / 9', maxHeight: '68vh', cursor: 'pointer' }}>
        <video ref={video} src={url} preload="metadata" playsInline disablePictureInPicture style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        {!playing && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 68, height: 68, borderRadius: 999, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={26} fill="#0d0d09" color="#0d0d09" style={{ marginLeft: 3 }} />
            </span>
          </span>
        )}
      </div>
      <div style={{ padding: '8px 12px 10px', background: '#0d0d09' }}>
        <div onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * dur) }}
          style={{ position: 'relative', height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2, background: '#D7C5FB' }} />
          <span style={{ position: 'absolute', left: `calc(${pct}% - 6px)`, width: 12, height: 12, borderRadius: 999, background: '#fff' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#fffcf9', fontSize: 12 }}>
          <IconButton dark side="top" label={playing ? 'Pause' : 'Play'} onClick={toggle}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</IconButton>
          <IconButton dark side="top" label="Back 10 seconds" onClick={() => seek(time - 10)}><RotateCcw size={15} /></IconButton>
          <IconButton dark side="top" label="Forward 10 seconds" onClick={() => seek(time + 10)}><RotateCw size={15} /></IconButton>
          <span style={{ fontVariantNumeric: 'tabular-nums', marginLeft: 6 }}>{fmtTime(time)} / {fmtTime(dur)}</span>
          <span style={{ flex: 1 }} />
          <button type="button" aria-label={`Speed ${speed}×`} className="gio-pressable" style={{ ...speedChip, background: 'transparent', color: '#fffcf9', borderColor: 'rgba(255,255,255,0.25)' }} onClick={cycle}>{speed}×</button>
          <IconButton dark side="top" label="Full screen" onClick={() => stage.current?.requestFullscreen?.()}><Maximize size={15} /></IconButton>
        </div>
      </div>
    </div>
  )
}

