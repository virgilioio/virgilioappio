import { useEffect, useRef, useState } from 'react'
import { Check, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tile, fileTypeFor, fmtSize } from '@/components/public/PublicFiles'
import {
  MEDIA_RULES,
  mediaFileProblem,
  uploadApplicationMedia,
  UploadProblem,
  type MediaKind,
  type StagedMedia,
} from '@/lib/applicationMedia'

const COPY: Record<MediaKind, { cta: string; drop: string }> = {
  audio: { cta: 'Upload a recording', drop: 'Drop an audio file here, or browse' },
  video: { cta: 'Upload a video', drop: 'Drop a video here, or browse' },
  file: { cta: 'Upload a file', drop: 'Drop a file here, or browse' },
}

const TILE_KEY: Record<MediaKind, string> = { audio: 'audio', video: 'video', file: 'pdf' }

/**
 * An Audio, Video or File upload answer on the public application form. The
 * file goes straight to storage with real progress (no 100 MB request through
 * a function); the form keeps the staged file and waits while it's uploading.
 */
export function MediaQuestionField({
  postingId,
  fieldId,
  kind,
  label,
  value,
  onChange,
  onBusyChange,
  invalid,
}: {
  postingId: string
  fieldId: string
  kind: MediaKind
  label: string
  value: StagedMedia | null
  onChange: (v: StagedMedia | null) => void
  onBusyChange?: (busy: boolean) => void
  invalid?: boolean
}) {
  const rule = MEDIA_RULES[kind]
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const start = async (file: File | undefined) => {
    if (!file || uploading) return
    const problem = mediaFileProblem(kind, file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setUploading({ name: file.name, pct: 0 })
    onBusyChange?.(true)
    try {
      const staged = await uploadApplicationMedia(postingId, fieldId, file, (pct) => setUploading({ name: file.name, pct }), ctrl.signal)
      onChange(staged)
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof UploadProblem ? e.message : 'Couldn’t upload that file. Try again.')
    } finally {
      abortRef.current = null
      setUploading(null)
      onBusyChange?.(false)
    }
  }

  const t = fileTypeFor(TILE_KEY[kind])

  return (
    <div>
      {uploading ? (
        <div className="flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3.5 py-3" aria-live="polite">
          <Tile t={t} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-inter text-[13px] font-medium text-text-primary">{uploading.name}</span>
              <span className="shrink-0 font-inter text-[12px] tabular-nums text-text-tertiary">{Math.round(uploading.pct)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ECEAE2]">
              <div className="gio-progress-fill h-full w-full rounded-full bg-virgilio-purple" style={{ transform: `scaleX(${uploading.pct / 100})` }} />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : value ? (
        <div className="flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3.5 py-3">
          <Tile t={t} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-inter text-[13px] font-medium text-text-primary">{value.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-inter text-[12px] text-text-tertiary">
              <Check className="h-3.5 w-3.5 text-[#0E8A65]" aria-hidden />
              <span>Uploaded · <span className="tabular-nums">{fmtSize(value.size)}</span></span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`${COPY[kind].cta} for ${label}`}
          aria-invalid={invalid || undefined}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void start(e.dataTransfer.files?.[0])
          }}
          data-drag-over={dragOver || undefined}
          className={
            'gio-dropzone flex w-full items-center gap-3 rounded-xl border border-dashed bg-[#FAFAF7] px-3.5 py-3.5 text-left data-[drag-over]:border-virgilio-purple data-[drag-over]:bg-[#F6F1FF] ' +
            (invalid ? 'border-[#C2372B]' : 'border-virgilio-border')
          }
        >
          <Tile t={t} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block font-inter text-[13px] font-medium text-text-primary">{COPY[kind].drop}</span>
            <span className="mt-0.5 block font-inter text-[12px] text-text-tertiary">{rule.hint}</span>
          </span>
          <Upload className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
        </button>
      )}
      <p className="mt-1 min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={error ? 'alert' : undefined}>
        {error ?? ''}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={rule.accept}
        className="hidden"
        onChange={(e) => {
          void start(e.target.files?.[0])
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}
