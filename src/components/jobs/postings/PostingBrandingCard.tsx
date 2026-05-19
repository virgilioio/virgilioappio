import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ImagePlus, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BrandingValue {
  hero_url?: string | null
  brand_color?: string | null
  show_team_photos?: boolean
  embed_video?: boolean
}

const SWATCHES = ['#0d0d09', '#7c5cff', '#16A34A', '#E85D3A', '#0A66C2', '#FFCD00']

interface Props {
  value: BrandingValue
  onChange: (v: BrandingValue) => void
  workspaceColor?: string | null
  readOnly?: boolean
}

export function PostingBrandingCard({ value, onChange, workspaceColor, readOnly }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const color = value.brand_color || workspaceColor || '#7c5cff'

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    onChange({ ...value, hero_url: url })
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary font-inter mb-2">
          Hero banner
        </div>
        <div className="rounded-xl border border-dashed border-virgilio-border bg-[#FAFAF7] overflow-hidden">
          {value.hero_url ? (
            <div className="relative aspect-[16/5] w-full">
              <img src={value.hero_url} alt="Hero" className="w-full h-full object-cover" />
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
            accept="image/*"
            className="hidden"
            onChange={onFile}
            disabled={readOnly}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileRef.current?.click()}
            disabled={readOnly}
          >
            {value.hero_url ? 'Replace banner' : 'Upload banner'}
          </Button>
          {value.hero_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, hero_url: null })}
              disabled={readOnly}
            >
              Remove
            </Button>
          )}
        </div>
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
              onClick={() => onChange({ ...value, brand_color: s })}
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
            onChange={(e) => onChange({ ...value, brand_color: e.target.value })}
            className="w-32 h-9"
            disabled={readOnly}
          />
          {!value.brand_color && (
            <span className="px-2 py-1 rounded-full bg-[#EDE4FF] text-virgilio-purple text-[11px]">
              From workspace
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-virgilio-border/60 border-t border-virgilio-border/60">
        <ToggleRow
          title="Show team photos on posting"
          helper="Pulls headshots from your About page"
          checked={!!value.show_team_photos}
          onChange={(v) => onChange({ ...value, show_team_photos: v })}
          disabled={readOnly}
        />
        <ToggleRow
          title="Embed culture video"
          helper="Plays inline above the apply form"
          checked={!!value.embed_video}
          onChange={(v) => onChange({ ...value, embed_video: v })}
          disabled={readOnly}
        />
      </div>
    </div>
  )
}

function ToggleRow({
  title,
  helper,
  checked,
  onChange,
  disabled,
}: {
  title: string
  helper: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <div className="font-poppins font-medium text-[13.5px] tracking-[-0.01em] text-text-primary">
          {title}
        </div>
        <div className="text-[12.5px] text-text-secondary">{helper}</div>
      </div>
      <Switch checked={checked} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} />
    </div>
  )
}
