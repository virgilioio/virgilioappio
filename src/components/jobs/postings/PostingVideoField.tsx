import { useRef, useState } from 'react'
import { Link2, Upload, Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import {
  embedUrl,
  mediaFileProblem,
  parseVideoLink,
  uploadPostingMedia,
  type PostingVideo,
} from '@/lib/postingMedia'

/**
 * "Embed video" on a job post: a link (YouTube, Vimeo, Loom or a direct .mp4)
 * or an uploaded MP4 (up to 200 MB). When it's on and set, the public post
 * opens it in a player over the page. Used by Create job › Posting and the
 * job page's posting sheet.
 */
export function PostingVideoField({
  value,
  onChange,
  jobId,
  readOnly,
}: {
  value: PostingVideo
  onChange: (next: PostingVideo) => void
  /** Uploads go into the job's folder; without a job only links work. */
  jobId: string | null | undefined
  readOnly?: boolean
}) {
  const segRef = useSegmentLayer<HTMLDivElement>()
  const fileRef = useRef<HTMLInputElement>(null)
  const [linkDraft, setLinkDraft] = useState(value.source === 'link' ? value.url ?? '' : '')
  const [linkTouched, setLinkTouched] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const parsed = linkDraft.trim() ? parseVideoLink(linkDraft) : null
  const linkError =
    linkTouched && linkDraft.trim() && !parsed ? 'Paste a YouTube, Vimeo or Loom link, or a link that ends in .mp4.' : undefined

  const commitLink = (raw: string) => {
    setLinkDraft(raw)
    const ok = raw.trim() ? parseVideoLink(raw) : null
    onChange({ ...value, source: 'link', url: ok ? raw.trim() : null, name: null })
  }

  const upload = async (file: File | undefined | null) => {
    if (!file || readOnly) return
    setUploadError(null)
    const problem = mediaFileProblem(file, 'video')
    if (problem) {
      setUploadError(problem)
      return
    }
    if (!jobId) {
      setUploadError('Save the job first, then upload its video.')
      return
    }
    setUploading(file.name)
    try {
      const url = await uploadPostingMedia(jobId, file, 'video')
      onChange({ ...value, source: 'upload', url, name: file.name })
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  const sources = [
    { id: 'link' as const, label: 'Paste a link', icon: Link2 },
    { id: 'upload' as const, label: 'Upload MP4', icon: Upload },
  ]

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-poppins font-medium text-[13.5px] tracking-[-0.01em] text-text-primary">Embed video</div>
          <div className="text-[12.5px] text-text-secondary">
            Opens in a player over the job post when it loads, with sound when the browser allows it.
          </div>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(on) => onChange({ ...value, enabled: !!on })}
          disabled={readOnly}
          aria-label="Embed video"
        />
      </div>

      {value.enabled && (
        <div className="mt-3 space-y-3">
          <div
            ref={segRef}
            role="radiogroup"
            aria-label="Video source"
            className="gio-seg inline-flex"
            style={{ gap: 4, padding: 3, background: '#ECEAE2', borderRadius: 9 }}
          >
            {sources.map((o) => {
              const active = value.source === o.id
              const Icon = o.icon
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-seg-option
                  data-active={active || undefined}
                  disabled={readOnly}
                  onClick={() => onChange({ ...value, source: o.id, url: o.id === 'link' ? (parsed ? linkDraft.trim() : null) : null, name: null })}
                  className="inline-flex items-center font-inter"
                  style={{
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 7,
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: active ? '#1F2230' : '#5A6072',
                    background: 'transparent',
                    transition: 'color var(--dur-hover) ease',
                  }}
                >
                  <Icon size={13} strokeWidth={2} />
                  {o.label}
                </button>
              )
            })}
            <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.12)" />
          </div>

          {value.source === 'link' ? (
            <div>
              <Input
                value={linkDraft}
                onChange={(e) => commitLink(e.target.value)}
                onBlur={() => setLinkTouched(true)}
                placeholder="https://www.youtube.com/watch?v=…"
                aria-label="Video link"
                aria-invalid={!!linkError}
                disabled={readOnly}
              />
              <p className="gio-field-message mt-1 min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={linkError ? 'alert' : undefined}>
                {linkError ?? ''}
              </p>
              {parsed && parsed.kind !== 'file' && (
                <div className="mt-1 aspect-video w-full max-w-[360px] overflow-hidden rounded-lg bg-black">
                  <iframe
                    title="Video preview"
                    src={embedUrl(parsed, { autoplay: false, sound: false })}
                    className="h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                  />
                </div>
              )}
              {parsed && parsed.kind === 'file' && (
                <video src={parsed.src} controls preload="metadata" className="mt-1 aspect-video w-full max-w-[360px] rounded-lg bg-black" />
              )}
            </div>
          ) : value.url ? (
            <div className="flex flex-wrap items-start gap-3">
              <video src={value.url} controls preload="metadata" className="aspect-video w-full max-w-[360px] rounded-lg bg-black" />
              <div className="min-w-0 space-y-2">
                <p className="max-w-[260px] truncate font-inter text-[12.5px] text-text-secondary">{value.name || 'Uploaded video'}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon={Upload} loading={!!uploading} disabled={readOnly} onClick={() => fileRef.current?.click()}>
                    Replace
                  </Button>
                  <Button variant="ghost" size="sm" disabled={readOnly || !!uploading} onClick={() => onChange({ ...value, url: null, name: null })}>
                    Remove
                  </Button>
                </div>
                <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={uploadError ? 'alert' : undefined}>{uploadError ?? ''}</p>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                disabled={readOnly || !!uploading}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  void upload(e.dataTransfer.files?.[0])
                }}
                data-drag-over={dragOver || undefined}
                className="gio-dropzone flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-virgilio-border bg-[#FAFAF7] px-4 py-6 text-center data-[drag-over]:border-virgilio-purple data-[drag-over]:bg-[#F6F1FF]"
              >
                {uploading ? (
                  <>
                    <span className="gio-spinner h-4 w-4" aria-hidden />
                    <span className="max-w-full truncate font-inter text-[12.5px] text-text-secondary">Uploading {uploading}…</span>
                  </>
                ) : (
                  <>
                    <Video className="h-5 w-5 text-text-tertiary" aria-hidden />
                    <span className="font-inter text-[12.5px] text-text-primary">Drop an MP4 here or click to choose one</span>
                    <span className="font-inter text-[11.5px] text-text-tertiary">Up to 200 MB</span>
                  </>
                )}
              </button>
              <p className="mt-1 min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={uploadError ? 'alert' : undefined}>{uploadError ?? ''}</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={(e) => {
              void upload(e.target.files?.[0])
              e.currentTarget.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}
