/**
 * Public dossier Files card + modal viewer.
 * Files arrive only through the share-token payload as short-lived signed URLs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  AudioLines, ChevronLeft, ChevronRight, Clapperboard, Download, ExternalLink, File, FileSpreadsheet,
  FileText, FileType2, Image as ImageIcon, Loader2, Maximize, Minus, Paperclip, Pause, Play, Plus,
  RotateCcw, RotateCw, X, type LucideIcon,
} from 'lucide-react'

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
  video: { key: 'video', name: 'Video', Icon: Clapperboard, fg: '#0d0d09', bg: '#F1F0EC', verb: 'Watch', verbIcon: Play, viewer: 'video' },
  image: { key: 'image', name: 'Image', Icon: ImageIcon, fg: '#0E8A65', bg: '#E7F7F1', verb: 'View', verbIcon: ExternalLink, viewer: 'image' },
  sheet: { key: 'sheet', name: 'Spreadsheet', Icon: FileSpreadsheet, fg: '#15803D', bg: '#EAF6EE', verb: '', verbIcon: null, viewer: null },
  other: { key: 'other', name: 'File', Icon: File, fg: '#5A6072', bg: '#F1F0EC', verb: '', verbIcon: null, viewer: null },
}

const EXT: Record<string, string> = {
  pdf: 'pdf', doc: 'word', docx: 'word',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', aac: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet',
}

const extOf = (n: string) => (n.split('.').pop() || '').toLowerCase()
function typeOf(f: PublicFile): TypeDef {
  const byExt = EXT[extOf(f.name)]
  if (byExt) return TYPES[byExt]
  const t = f.type || ''
  if (t.includes('pdf')) return TYPES.pdf
  if (t.startsWith('audio/')) return TYPES.audio
  if (t.startsWith('video/')) return TYPES.video
  if (t.startsWith('image/')) return TYPES.image
  return TYPES.other
}
const fmtSize = (b: number | null) => (!b ? '' : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`)
const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
const downloadUrl = (f: PublicFile) => (f.url ? `${f.url}${f.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(f.name)}` : '#')

function Tile({ t, size = 36, ext }: { t: TypeDef; size?: number; ext?: string }) {
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
  const [meta, setMeta] = useState<Record<string, string>>({})
  if (!files.length) return null
  const previewable = files.map((f, i) => ({ f, i })).filter(({ f }) => typeOf(f).viewer)
  const setInfo = (id: string, v: string) => setMeta((m) => (m[id] === v ? m : { ...m, [id]: v }))

  return (
    <section style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8B8F9E' }}>
        <Paperclip size={11} /> Files
        <span style={{ marginLeft: 'auto', letterSpacing: 0 }}>{files.length}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {files.map((f, i) => (
          <FileRowItem key={f.id} f={f} info={meta[f.id]} onOpen={() => (typeOf(f).viewer ? setOpenIdx(i) : window.open(downloadUrl(f), '_self'))} />
        ))}
      </div>
      {openIdx !== null && (
        <FileModal
          files={previewable.map((p) => p.f)}
          index={Math.max(0, previewable.findIndex((p) => p.i === openIdx))}
          onIndex={(k) => setOpenIdx(previewable[k].i)}
          onClose={() => setOpenIdx(null)}
          onInfo={setInfo}
        />
      )}
    </section>
  )
}

function FileRowItem({ f, info, onOpen }: { f: PublicFile; info?: string; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const t = typeOf(f)
  const primary = f.label?.trim() || f.name
  const parts = [f.label?.trim() ? f.name : null, info || t.name, fmtSize(f.size) || null].filter(Boolean)
  const VI = t.verbIcon
  return (
    <button
      type="button" onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="font-inter"
      style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 8px', margin: '0 -8px', boxSizing: 'content-box', background: hover ? '#FBFAF7' : 'transparent', border: 0, borderRadius: 10, textAlign: 'left', cursor: 'pointer' }}
    >
      <Tile t={t} ext={extOf(f.name)} />
      <span style={{ minWidth: 0, flex: 1, marginLeft: 4 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#1F2230', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</span>
        <span style={{ display: 'block', fontSize: 11, color: '#8B8F9E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts.join(' · ')}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 500, color: hover ? '#6F3FF5' : '#8B8F9E', flexShrink: 0 }}>
        {VI ? (<>{t.verb} <VI size={12} /></>) : <Download size={14} aria-label="Download" />}
      </span>
    </button>
  )
}

/* ---------------- Modal ---------------- */

const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: 0, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1F2230' }

function FileModal({ files, index, onIndex, onClose, onInfo }: { files: PublicFile[]; index: number; onIndex: (i: number) => void; onClose: () => void; onInfo: (id: string, v: string) => void }) {
  const f = files[index]
  const t = typeOf(f)
  const go = useCallback((d: number) => { const n = index + d; if (n >= 0 && n < files.length) onIndex(n) }, [index, files.length, onIndex])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [go, onClose])

  const added = new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,9,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} className="font-inter"
        style={{ width: '100%', maxWidth: 980, maxHeight: '92vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px -16px rgba(0,0,0,0.35)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid #EEEDE8' }}>
          <Tile t={t} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="font-poppins" style={{ fontSize: 14, fontWeight: 600, color: '#0d0d09', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label?.trim() || f.name}</div>
            <div style={{ fontSize: 11, color: '#8B8F9E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[f.name, fmtSize(f.size), `Added ${added}`].filter(Boolean).join(' · ')}</div>
          </div>
          {files.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11.5, color: '#5A6072' }}>
              <button style={{ ...iconBtn, opacity: index ? 1 : 0.35 }} onClick={() => go(-1)} aria-label="Previous file"><ChevronLeft size={15} /></button>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{index + 1} of {files.length}</span>
              <button style={{ ...iconBtn, opacity: index < files.length - 1 ? 1 : 0.35 }} onClick={() => go(1)} aria-label="Next file"><ChevronRight size={15} /></button>
            </div>
          )}
          <span style={{ width: 1, height: 20, background: '#E7E8EE' }} />
          <a href={downloadUrl(f)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid #E7E8EE', fontSize: 12, fontWeight: 500, color: '#1F2230', textDecoration: 'none' }}>
            <Download size={13} /> Download
          </a>
          <button style={iconBtn} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
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
      </div>
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
          <button style={{ ...iconBtn, width: 26, height: 26 }} disabled={zoom <= 60} onClick={() => setZoom((z) => Math.max(60, z - 20))} aria-label="Zoom out"><Minus size={13} /></button>
          <span style={{ width: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{zoom}%</span>
          <button style={{ ...iconBtn, width: 26, height: 26 }} disabled={zoom >= 180} onClick={() => setZoom((z) => Math.min(180, z + 20))} aria-label="Zoom in"><Plus size={13} /></button>
        </span>
      </div>
      <div ref={scroller} onScroll={onScroll} style={{ flex: 1, minHeight: 360, maxHeight: '74vh', overflow: 'auto', background: '#EDEBE5', padding: 20, position: 'relative' }}>
        {!doc ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Loader2 className="animate-spin" size={22} color="#8B8F9E" /></div>
        ) : Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} zoom={zoom} />)}
      </div>
    </>
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
        <button style={iconBtn} onClick={() => seek(time - 15)} aria-label="Back 15 seconds"><RotateCcw size={17} /></button>
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 48, height: 48, borderRadius: 999, border: 0, background: '#0d0d09', color: '#fffcf9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <button style={iconBtn} onClick={() => seek(time + 15)} aria-label="Forward 15 seconds"><RotateCw size={17} /></button>
        <span style={{ minWidth: 96 }}><button style={speedChip} onClick={cycle}>{speed}×</button></span>
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
  const ctl: React.CSSProperties = { ...iconBtn, color: '#fffcf9' }
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
          <button style={ctl} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
          <button style={ctl} onClick={() => seek(time - 10)} aria-label="Back 10 seconds"><RotateCcw size={15} /></button>
          <button style={ctl} onClick={() => seek(time + 10)} aria-label="Forward 10 seconds"><RotateCw size={15} /></button>
          <span style={{ fontVariantNumeric: 'tabular-nums', marginLeft: 6 }}>{fmtTime(time)} / {fmtTime(dur)}</span>
          <span style={{ flex: 1 }} />
          <button style={{ ...speedChip, background: 'transparent', color: '#fffcf9', borderColor: 'rgba(255,255,255,0.25)' }} onClick={cycle}>{speed}×</button>
          <button style={ctl} onClick={() => stage.current?.requestFullscreen?.()} aria-label="Full screen"><Maximize size={15} /></button>
        </div>
      </div>
    </div>
  )
}

export const _internal = { typeOf, useMemo }
