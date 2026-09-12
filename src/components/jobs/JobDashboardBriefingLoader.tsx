import { Check, LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type BriefingPhaseKey = 'read' | 'snapshot' | 'analyse' | 'write'
export type BriefingPhaseState = {
  status: 'pending' | 'active' | 'done'
  startedAt?: number
  endedAt?: number
  detail?: string
}
export type BriefingStatTile = {
  label: string
  value: string
  qualifier: string
  tone: 'neutral' | 'amber' | 'red' | 'green'
  empty?: boolean
}

const PHASE_LABELS: Record<BriefingPhaseKey, string> = {
  read: 'Reading the pipeline',
  snapshot: 'Preparing a private snapshot',
  analyse: 'Gio is analysing',
  write: 'Writing your briefing',
}

const TONE_COLORS = {
  neutral: '#8B8F9E',
  amber: '#B45309',
  red: '#C92A2A',
  green: '#0B7A52',
} as const

function duration(phase: BriefingPhaseState) {
  if (phase.startedAt == null || phase.endedAt == null) return null
  return `${((phase.endedAt - phase.startedAt) / 1000).toFixed(1)}s`
}

function TileSkeleton() {
  return (
    <div className="briefing-tile-skeleton bg-white">
      <span className="h-[9px] w-20" />
      <span className="h-[22px] w-12" />
      <span className="h-2 w-28" />
    </div>
  )
}

function StatTile({ tile, index }: { tile: BriefingStatTile; index: number }) {
  return (
    <div className="briefing-tile-rise bg-white" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="text-[11.5px] font-medium text-[#8B8F9E]">{tile.label}</div>
      <div className="mt-1 font-poppins text-[27px] font-semibold leading-[1.1] tracking-[-0.04em] tabular-nums" style={{ color: tile.empty ? '#B5B9C4' : '#0d0d09' }}>
        {tile.value}
      </div>
      <div className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: TONE_COLORS[tile.tone] }}>{tile.qualifier}</div>
    </div>
  )
}

interface JobDashboardBriefingLoaderProps {
  phases: Partial<Record<BriefingPhaseKey, BriefingPhaseState>>
  stats: BriefingStatTile[] | null
  prose: string
  elapsedSeconds: number
  slowAnalysis: boolean
  error: string | null
  incomplete: boolean
  onCancel: () => void
  onRetry: () => void
  issueCards?: React.ReactNode
  receipt?: string
}

export function JobDashboardBriefingLoader({
  phases,
  stats,
  prose,
  elapsedSeconds,
  slowAnalysis,
  error,
  incomplete,
  onCancel,
  onRetry,
  issueCards,
  receipt,
}: JobDashboardBriefingLoaderProps) {
  const announced = (Object.entries(phases) as [BriefingPhaseKey, BriefingPhaseState][])
  const writing = phases.write?.status === 'active' || prose.length > 0
  const activeLabel = writing ? 'Writing…' : 'Working…'

  return (
    <div className="mx-auto w-full px-[18px] pb-14 pt-6 sm:px-7" style={{ maxWidth: 768, fontFamily: 'Inter, sans-serif' }}>
      <div className={`briefing-loader-card ${error ? 'briefing-loader-error' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-[22px] items-center justify-center rounded-md bg-[#E9DEFE]">
            <Sparkles size={12} color="#6F3FF5" strokeWidth={2} />
          </span>
          <span className="font-poppins text-xs font-semibold text-[#5A6072]">Gio's read</span>
          <span className="ml-auto text-[11.5px] text-[#8B8F9E]">{error ? 'Stopped' : activeLabel}</span>
          <span className="font-mono text-[11px] tabular-nums text-[#A7ABB8]">{elapsedSeconds.toFixed(1)}s</span>
        </div>

        {writing ? (
          <>
            {receipt && (
              <div className="mt-4 flex items-center gap-2 border-b border-[#F1F0EC] pb-3 text-[11.5px] text-[#8B8F9E]">
                <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#E4F3EC]">
                  <Check size={10} color="#0B7A52" strokeWidth={2.5} />
                </span>
                <span>{receipt}</span>
              </div>
            )}
            <p className="briefing-stream-prose mt-[14px]">
              {prose}
              {!error && <span className="briefing-caret" aria-hidden="true" />}
            </p>
          </>
        ) : (
          <div className="mt-4">
            {announced.length === 0 && (
              <div className="flex items-center gap-2 py-[7px]">
                <LoaderCircle size={16} className="briefing-spinner text-[#6F3FF5]" />
                <span className="text-[13px] font-semibold text-[#1F2230]">Working…</span>
              </div>
            )}
            {announced.map(([key, phase]) => {
              const measured = duration(phase)
              const detail = key === 'analyse' && slowAnalysis
                ? 'Still analysing — the model is taking longer than usual'
                : phase.detail
              return (
                <div key={key} className={`briefing-phase briefing-phase-${phase.status}`}>
                  <div className="flex items-start gap-2.5">
                    {phase.status === 'done' ? (
                      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#E4F3EC]">
                        <Check size={10} color="#0B7A52" strokeWidth={2.5} />
                      </span>
                    ) : phase.status === 'active' ? (
                      <span className="briefing-spinner size-4 shrink-0 rounded-full border-2 border-[#E9DEFE] border-t-[#6F3FF5]" />
                    ) : (
                      <span className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-[#DCDCD4]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={phase.status === 'active' ? 'text-[13px] font-semibold text-[#1F2230]' : 'text-[13px] font-medium text-[#5A6072]'}>{PHASE_LABELS[key]}</span>
                        {measured && <span className="font-mono text-[10.5px] tabular-nums text-[#A7ABB8]">{measured}</span>}
                      </div>
                      {phase.status === 'active' && detail && <div className="mt-0.5 text-[11.5px] text-[#8B8F9E]">{detail}</div>}
                      {phase.status === 'active' && <div className="briefing-sweep-track mt-2"><span /></div>}
                    </div>
                  </div>
                </div>
              )
            })}
            {slowAnalysis && !error && <Button type="button" variant="link" size="xs" onClick={onCancel} className="mt-1">Cancel</Button>}
          </div>
        )}

        {error && (
          <div className="mt-4 border-t border-[#F1F0EC] pt-3">
            <div className="text-[13px] font-semibold text-[#1F2230]">{incomplete ? 'Incomplete — Gio lost the connection' : "Gio couldn't finish this briefing"}</div>
            <div className="mt-1 text-[11.5px] text-[#8B8F9E]">{error}</div>
            <Button type="button" variant="link" size="xs" onClick={onRetry} className="mt-1 px-0">{incomplete ? 'Regenerate' : 'Try again'}</Button>
          </div>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats ? stats.map((tile, index) => <StatTile key={tile.label} tile={tile} index={index} />) : <><TileSkeleton /><TileSkeleton /><TileSkeleton /></>}
      </div>
      {issueCards && <div className="briefing-issues-rise mt-[30px]">{issueCards}</div>}
    </div>
  )
}

export const jobDashboardBriefingLoaderCss = `
.briefing-loader-card { background:#fffcf9; border:1px solid #E7E8EE; border-radius:14px; box-shadow:0 1px 2px rgba(13,13,9,.03),0 1px 0 rgba(13,13,9,.02); padding:26px 28px; }
.briefing-loader-error { border-top-color:#C92A2A; }
.briefing-phase { padding:7px 0; }
.briefing-phase-pending { opacity:.45; }
.briefing-spinner { animation:briefingSpin .9s linear infinite; }
.briefing-sweep-track { height:2px; overflow:hidden; border-radius:999px; background:#F1EBFE; }
.briefing-sweep-track span { display:block; width:32%; height:100%; border-radius:999px; background:#B79BF0; animation:briefingSweep 1.15s ease-in-out infinite; }
.briefing-stream-prose { color:#1F2230; font:400 16.5px/1.7 Inter,sans-serif; letter-spacing:-.006em; text-wrap:pretty; white-space:pre-wrap; }
.briefing-caret { display:inline-block; width:2px; height:1em; margin-left:2px; vertical-align:-.12em; background:#6F3FF5; animation:briefingCaret 1s steps(1,end) infinite; }
.briefing-tile-skeleton,.briefing-tile-rise { min-height:94px; border:1px solid #E7E8EE; border-radius:12px; padding:14px 16px 13px; box-shadow:0 1px 2px rgba(13,13,9,.03); }
.briefing-tile-skeleton { display:flex; flex-direction:column; gap:10px; }
.briefing-tile-skeleton span { display:block; border-radius:4px; background:#F1F0EC; animation:briefingPulse 1.4s ease-in-out infinite; }
.briefing-tile-rise { animation:briefingRise .42s cubic-bezier(.22,1,.36,1) both; }
.briefing-issues-rise { animation:briefingRise .42s .12s cubic-bezier(.22,1,.36,1) both; }
@keyframes briefingSpin { to { transform:rotate(360deg) } }
@keyframes briefingSweep { from { transform:translateX(-110%) } to { transform:translateX(330%) } }
@keyframes briefingCaret { 50% { opacity:0 } }
@keyframes briefingPulse { 50% { opacity:.45 } }
@keyframes briefingRise { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
@media (max-width:639px) { .briefing-loader-card { padding:20px 18px; } .briefing-stream-prose { font-size:15px; } }
@media (prefers-reduced-motion:reduce) { .briefing-spinner,.briefing-sweep-track span,.briefing-caret,.briefing-tile-skeleton span,.briefing-tile-rise,.briefing-issues-rise { animation:none !important; } }
`