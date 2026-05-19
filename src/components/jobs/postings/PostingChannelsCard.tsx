import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Zap, Globe, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChannelState {
  enabled: boolean
  cost?: number
}

export interface ChannelsValue {
  publishToTalent: boolean
  channels: Record<string, ChannelState>
}

interface ChannelDef {
  code: string
  name: string
  meta: string
  glyph: string
  glyphBg: string
  glyphFg: string
  alwaysOn?: boolean
  recommended?: boolean
  statusOn: string
  statusOff: string
  cost?: number
  free?: boolean
}

const CHANNELS: ChannelDef[] = [
  {
    code: 'careers',
    name: 'Acme Talent careers page',
    meta: 'Your branded careers site · always live',
    glyph: 'A',
    glyphBg: 'bg-virgilio-purple/10',
    glyphFg: 'text-virgilio-purple',
    alwaysOn: true,
    recommended: true,
    statusOn: 'Always on',
    statusOff: 'Always on',
    free: true,
  },
  {
    code: 'linkedin',
    name: 'LinkedIn',
    meta: 'Sponsored job · estimated reach 12k',
    glyph: 'in',
    glyphBg: 'bg-[#0A66C2]',
    glyphFg: 'text-white',
    statusOn: 'Connected · $129 / 30 days',
    statusOff: 'Not connected',
    cost: 129,
  },
  {
    code: 'wtj',
    name: 'Welcome to the Jungle',
    meta: 'Premium employer brand network',
    glyph: 'W',
    glyphBg: 'bg-[#FFCD00]',
    glyphFg: 'text-[#0D0D09]',
    statusOn: 'Connected · $0 (included)',
    statusOff: 'Not connected',
    free: true,
  },
  {
    code: 'ziprecruiter',
    name: 'ZipRecruiter',
    meta: 'Aggregator · pay-per-click',
    glyph: 'Z',
    glyphBg: 'bg-[#5A6BFF]',
    glyphFg: 'text-white',
    statusOn: 'Connected · $89 / 30 days',
    statusOff: 'Not connected',
    cost: 89,
  },
  {
    code: 'google_jobs',
    name: 'Google for Jobs',
    meta: 'Auto-indexed when SEO is on',
    glyph: 'G',
    glyphBg: 'bg-white border border-virgilio-border',
    glyphFg: 'text-[#0D0D09]',
    statusOn: 'Free · auto',
    statusOff: 'Free · auto',
    free: true,
  },
  {
    code: 'indeed',
    name: 'Indeed',
    meta: 'Free tier · organic placement',
    glyph: 'I',
    glyphBg: 'bg-[#003A9B]',
    glyphFg: 'text-white',
    statusOn: 'Free · organic',
    statusOff: 'Not connected',
    free: true,
  },
]

interface Props {
  value: ChannelsValue
  onChange: (v: ChannelsValue) => void
  readOnly?: boolean
}

export function PostingChannelsCard({ value, onChange, readOnly }: Props) {
  const setChannel = (code: string, enabled: boolean) => {
    if (code === 'careers') {
      onChange({ ...value, publishToTalent: enabled })
      return
    }
    onChange({
      ...value,
      channels: {
        ...value.channels,
        [code]: { ...(value.channels[code] || {}), enabled },
      },
    })
  }

  const isOn = (code: string) => {
    if (code === 'careers') return value.publishToTalent || true // always on
    return !!value.channels[code]?.enabled
  }

  const enabledList = CHANNELS.filter((c) => c.alwaysOn || isOn(c.code))
  const paid = enabledList.filter((c) => !c.free)
  const free = enabledList.filter((c) => c.free)
  const totalCost = paid.reduce((sum, c) => sum + (c.cost || 0), 0)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-virgilio-border bg-surface-primary divide-y divide-virgilio-border/60">
        {CHANNELS.map((ch) => {
          const on = ch.alwaysOn ? true : isOn(ch.code)
          return (
            <div key={ch.code} className="flex items-center gap-4 px-5 py-4">
              <div
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center text-[13px] font-semibold shrink-0',
                  ch.glyphBg,
                  ch.glyphFg
                )}
              >
                {ch.glyph}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-poppins font-medium text-[13.5px] tracking-[-0.01em] text-text-primary">
                    {ch.name}
                  </span>
                  {ch.recommended && (
                    <Badge tone="lilac" size="xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-[12.5px] text-text-secondary mt-0.5">{ch.meta}</p>
              </div>
              <div className="text-[12px] text-text-secondary text-right tabular-nums">
                {on ? ch.statusOn : ch.statusOff}
              </div>
              <Switch
                checked={on}
                onCheckedChange={(v) => setChannel(ch.code, !!v)}
                disabled={readOnly || ch.alwaysOn}
              />
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-[#0d0d09] text-[#FFFCF9] px-5 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-white/10 flex items-center justify-center">
          <Zap className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.06em] text-white/60 font-inter">
            Posting total
          </div>
          <div className="font-poppins font-semibold text-[15px] tracking-[-0.02em]">
            {totalCost > 0 ? `$${totalCost} / 30 days` : '$0 (Careers page only)'}
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-virgilio-purple/30 text-[11.5px] text-white">
          {free.length} free · {paid.length} paid
        </span>
      </div>
    </div>
  )
}
