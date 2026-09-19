import { Sparkles } from 'lucide-react'
import { GIO_FIT_P50_SECONDS, GioFitNarration, GioFitProgressBar, buildNarrationSteps, stepProgress, type NarrationStep } from './GioFitNarration'
import './gioFitLoading.css'

const cardClass = 'rounded-[14px] border border-virgilio-border bg-surface-primary'

/** The single skeleton bar primitive. Every placeholder in this file uses it. */
export function Sk({ w, h, r, dark, className }: { w?: number | string; h: number; r?: number; dark?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`${dark ? 'gf-sk-dark' : 'gf-sk'} block${className ? ` ${className}` : ''}`}
      style={{ width: typeof w === 'number' ? `${w}px` : w ?? '100%', height: `${h}px`, borderRadius: r === undefined ? undefined : `${r}px` }}
    />
  )
}

interface GioFitColdSkeletonProps {
  candidateName: string
  roleLine: string | null
  outputLanguageName: string
  stepIndex: number
  progress: number
  /** Narration stages to show. Progress and the step count derive from this array. */
  steps?: NarrationStep[]
  /** False where the hero above already carries the name and role — don't repeat them. */
  identity?: boolean
  eyebrow?: string
  eta?: string
}

function SkillRow({ count }: { count: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-3">
      <Sk w={140} h={11} />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: count }).map((_, index) => (
          <Sk key={index} w={62 + ((index * 23) % 52)} h={26} r={7} />
        ))}
      </div>
    </div>
  )
}

export function GioFitColdSkeleton({
  candidateName, roleLine, outputLanguageName, stepIndex, progress,
  steps: stepsProp, identity = true,
  eyebrow = 'Gio is assessing this candidate',
  eta = `Usually takes about ${GIO_FIT_P50_SECONDS} seconds`,
}: GioFitColdSkeletonProps) {
  const steps = stepsProp ?? buildNarrationSteps(outputLanguageName)
  // With explicit steps the track reads from that array, not the module pacing.
  const trackProgress = stepsProp ? stepProgress(stepIndex, stepsProp.length) : progress

  return (
    <div className="space-y-3.5">
      <section className={`${cardClass} p-[22px]`}>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="min-w-0">
            <p className="gf-eyebrow font-inter"><Sparkles className="h-3 w-3" /> {eyebrow}</p>
            {identity && (
              <>
                <h2 className="mt-1.5 font-poppins text-[26px] font-semibold leading-[1.1] tracking-[-0.04em] text-fit-ink">
                  {candidateName}<span className="text-fit-lilac">.</span>
                </h2>
                {roleLine && <p className="mt-1.5 text-[13.5px] font-medium text-fit-ink">{roleLine}</p>}
              </>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <Sk w={92} h={11} />
              <Sk w={120} h={11} />
              <Sk w={78} h={11} />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-end gap-3">
            <Sk w={74} h={44} r={10} dark />
            <div className="space-y-1.5 pb-[3px]">
              <Sk w={66} h={12} />
              <Sk w={92} h={10} />
            </div>
          </div>
        </div>
        <div className="gf-hairline mt-[18px] grid gap-6 pt-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <GioFitNarration steps={steps} stepIndex={stepIndex} />
          <div className="w-[200px] max-w-full self-end">
            <GioFitProgressBar progress={trackProgress} />
            <p className="gf-progress-note">{eta}</p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className={cardClass}>
          {/* Summary */}
          <div className="px-[22px] py-5">
            <Sk w={104} h={10} />
            <div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <div className="space-y-2">
                  {['100%', '100%', '94%', '88%'].map((width, index) => <Sk key={index} w={width} h={11} />)}
                </div>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {['gf-callout-green', 'gf-callout-amber'].map((tint) => (
                    <div key={tint} className={`${tint} flex h-[78px] flex-col justify-center gap-2 px-3`}>
                      <Sk w={86} h={9} />
                      <Sk w="94%" h={10} />
                      <Sk w="76%" h={10} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className={`space-y-2 py-3 first:pt-0 last:pb-0${index > 0 ? ' gf-statline' : ''}`}>
                    <Sk w={28} h={20} dark />
                    <Sk w="70%" h={10} />
                    <Sk w="48%" h={9} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Identified skills */}
          <div className="gf-hairline px-[22px] py-[18px]">
            <Sk w={120} h={10} />
            <div className="mt-4 space-y-3">
              {[6, 1, 5].map((count, index) => <SkillRow key={index} count={count} />)}
            </div>
          </div>

          {/* Experience */}
          <div className="gf-hairline px-[22px] py-[18px]">
            <Sk w={96} h={10} />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5">
                  <div className="space-y-2">
                    <Sk w={132} h={11} />
                    <Sk w={88} h={10} />
                  </div>
                  <div className="space-y-2">
                    <Sk w="62%" h={14} dark />
                    <Sk w="100%" h={10} />
                    <Sk w="84%" h={10} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-3.5">
          {/* Dimension breakdown — exactly seven rows, matching the real count */}
          <section className={cardClass}>
            <div className="gf-hairline space-y-2 border-t-0 px-4 py-4" style={{ borderBottom: '1px solid #F1F0EC' }}>
              <Sk w={150} h={10} />
              <Sk w="86%" h={10} />
            </div>
            <div>
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="gf-hairline px-4 py-3 first:border-t-0">
                  <div className="flex items-center gap-2">
                    <Sk w={8} h={8} r={2} dark />
                    <Sk w={96 + ((index * 17) % 46)} h={11} />
                    <span className="ml-auto"><Sk w={22} h={13} dark /></span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-4">
                    <span className="min-w-0 flex-1"><Sk h={5} /></span>
                    <Sk w={64} h={9} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Validation points */}
          <section className={cardClass}>
            <div className="space-y-2 px-4 py-4" style={{ borderBottom: '1px solid #F1F0EC' }}>
              <Sk w={120} h={10} />
              <Sk w="80%" h={10} />
            </div>
            <div className="px-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={`flex items-start gap-2.5 py-3.5${index > 0 ? ' gf-hairline' : ''}`}>
                  <span className="gf-sk mt-0.5 block h-[15px] w-[15px] shrink-0 rounded-full" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Sk w="88%" h={11} />
                    <Sk w="70%" h={10} />
                    <Sk w={104} h={9} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
