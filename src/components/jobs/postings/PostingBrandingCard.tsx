import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImagePlus, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mediaFileProblem, uploadPostingMedia, type PostingBranding } from '@/lib/postingMedia'
import { PostingVideoField } from './PostingVideoField'

/** The posting's branding, in the shared shape (src/lib/postingMedia.ts). */
export type BrandingValue = PostingBranding

const SWATCHES = ['#0d0d09', '#7c5cff', '#16A34A', '#E85D3A', '#0A66C2', '#FFCD00']

interface Props {
  value: BrandingValue
  onChange: (v: BrandingValue) => void
  workspaceColor?: string | null
  readOnly?: boolean
  /** Covers and videos are stored in the job's folder. */
  jobId: string | null | undefined
}

export function PostingBrandingCard({ value, onChange, workspaceColor, readOnly, jobId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const color = value.brandColor || workspaceColor || '#7c5cff'
  const [uploading, setUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)

  // The cover is uploaded right away and the posting keeps its public address,
  // so the public job post can show it (it used to keep a temporary browser link).
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setCoverError(null)
    const problem = mediaFileProblem(f, 'cover')
    if (problem) return setCoverError(problem)
    if (!jobId) return setCoverError('Save the job first, then upload its cover.')
    setUploading(true)
    try {
      const url = await uploadPostingMedia(jobId, f, 'cover')
      onChange({ ...value, bannerUrl: url, bannerName: f.name })
    } catch (err) {
      setCoverError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary font-inter mb-2">
          Hero banner
        </div>
        <div className="rounded-xl border border-dashed border-virgilio-border bg-[#FAFAF7] overflow-hidden">
          {value.bannerUrl ? (
            <div className="relative aspect-[16/5] w-full">
              <img src={value.bannerUrl} alt="Cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[16/5] w-full flex flex-col items-center justify-center text-center gap-2 p-6">
              <ImagePlus className="h-6 w-6 text-text-tertiary" />
              <p className="text-[12.5px] text-text-secondary">
                Using workspace default cover · recommended 1600×480
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void onFile(e)}
            disabled={readOnly || uploading}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileRef.current?.click()}
            disabled={readOnly}
            loading={uploading}
          >
            {value.bannerUrl ? 'Replace banner' : 'Upload banner'}
          </Button>
          {value.bannerUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, bannerUrl: null, bannerName: null })}
              disabled={readOnly || uploading}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1 min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={coverError ? 'alert' : undefined}>
          {coverError ?? ''}
        </p>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary font-inter mb-2">
          Brand color
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...value, brandColor: s })}
              disabled={readOnly}
              className={cn(
                'h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-surface-primary transition',
                color.toLowerCase() === s.toLowerCase()
                  ? 'ring-virgilio-purple'
                  : 'ring-transparent hover:ring-virgilio-border'
              )}
              style={{ background: s }}
              aria-label={s}
            />
          ))}
          <Input
            value={color}
            onChange={(e) => onChange({ ...value, brandColor: e.target.value })}
            className="w-32 h-9"
            disabled={readOnly}
          />
          {!value.brandColor && (
            <span className="px-2 py-1 rounded-full bg-[#EDE4FF] text-virgilio-purple text-[11px]">
              From workspace
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-virgilio-border/60 border-t border-virgilio-border/60">
        <PostingVideoField
          value={value.video}
          onChange={(video) => onChange({ ...value, video })}
          jobId={jobId}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
