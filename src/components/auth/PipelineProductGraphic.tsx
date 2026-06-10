import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import avatarDaniel from '@/assets/avatar-daniel.jpg'
import avatarMateo from '@/assets/avatar-mateo.jpg'
import avatarSofia from '@/assets/avatar-sofia.jpg'
import avatarMateoServices from '@/assets/avatar-mateo-services.jpg'

interface CandidateCardProps {
  avatar: string
  name: string
  country: string
  score: string
  scoreBg: string
  scoreText: string
  meta: string
  delay: number
  hovered: boolean
  countDelay?: number
  highlight?: boolean
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function CandidateCard({
  avatar,
  name,
  country,
  score,
  scoreBg,
  scoreText,
  meta,
  delay,
  hovered,
  countDelay = 0,
  highlight = false,
}: CandidateCardProps) {
  const numericTarget = Number(score)
  const isNumeric = !Number.isNaN(numericTarget) && score.trim() !== ''
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!isNumeric) return
    if (!hovered) {
      setDisplay(0)
      return
    }
    let raf: number
    let start: number | null = null
    const duration = 900
    const startTimeout = window.setTimeout(() => {
      const step = (ts: number) => {
        if (start === null) start = ts
        const t = Math.min(1, (ts - start) / duration)
        setDisplay(Math.round(easeOutCubic(t) * numericTarget))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, countDelay)
    return () => {
      window.clearTimeout(startTimeout)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [hovered, isNumeric, numericTarget, countDelay])

  return (
    <div
      className={[
        'rounded-2xl bg-[#FAF8F3] p-3.5 animate-card-rise',
        'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'hover:-translate-y-[2px]',
        highlight
          ? 'ring-1 ring-[#d7c5fb] shadow-[0_12px_28px_-14px_rgba(215,197,251,0.9)]'
          : 'ring-1 ring-black/[0.06]',
      ].join(' ')}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top: avatar + name/country */}
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          alt=""
          loading="lazy"
          width={48}
          height={48}
          className="h-11 w-11 rounded-full object-cover shrink-0 ring-1 ring-black/5"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="font-poppins font-semibold text-[13.5px] text-[#0d0d09] leading-tight tracking-[-0.01em] truncate">
            {name}
          </div>
          <div className="text-[11.5px] text-[#5A6072] leading-tight truncate mt-0.5">
            {country}
          </div>
        </div>
      </div>

      {/* Bottom: score chip + meta */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className="text-[11px] font-semibold rounded-full px-2 py-0.5 tabular-nums"
          style={{ background: scoreBg, color: scoreText }}
        >
          {isNumeric ? `${display}%` : score}
        </span>
        <span className="text-[11px] text-[#8B8F9E] tabular-nums">{meta}</span>
      </div>
    </div>
  )
}

interface ColumnProps {
  label: string
  count: number
  children: React.ReactNode
}
function Column({ label, count, children }: ColumnProps) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-[12px] font-semibold text-[#0d0d09] tracking-[-0.01em]">
          {label}
        </span>
        <span className="text-[12px] font-medium text-[#8B8F9E] tabular-nums">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function PipelineProductGraphic() {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative w-full max-w-[640px] mx-auto">
      {/* Decorative shapes behind the card */}
      <div
        aria-hidden
        className="absolute -top-6 right-10 w-16 h-16 rounded-full bg-[#0d0d09] z-0 animate-float-soft"
      />
      <div
        aria-hidden
        className="absolute -top-3 right-24 w-56 h-56 rounded-full bg-[#d6e6ff] z-0 animate-float-soft"
        style={{ animationDelay: '1.2s' }}
      />

      {/* Card */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative z-10 bg-white rounded-[28px] shadow-[0_30px_70px_-30px_rgba(13,13,9,0.22)] ring-1 ring-black/[0.06] p-6 sm:p-7 animate-panel-rise"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-poppins font-bold text-[18px] sm:text-[19px] text-[#0d0d09] tracking-[-0.025em]">
            Account Executive · Pipeline
          </h3>
          <span className="inline-flex items-center text-[12px] font-semibold text-[#5b3fa3] bg-[#EDE4FF] rounded-full px-3 py-1">
            9 active
          </span>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-3 gap-4">
          <Column label="Screening" count={3}>
            <CandidateCard
              avatar={avatarDaniel}
              name="Daniel O."
              country="Colombia"
              score="88"
              scoreBg="hsl(266 92% 88%)"
              scoreText="hsl(266 50% 30%)"
              meta="2d"
              delay={300}
              hovered={hovered}
              countDelay={0}
            />
            <CandidateCard
              avatar={avatarMateo}
              name="Mateo A."
              country="Chile"
              score="81"
              scoreBg="hsl(210 90% 90%)"
              scoreText="hsl(210 60% 30%)"
              meta="4d"
              delay={550}
              hovered={hovered}
              countDelay={120}
            />
          </Column>

          <Column label="Interview" count={2}>
            <CandidateCard
              avatar={avatarSofia}
              name="Sofia B."
              country="Mexico"
              score="92"
              scoreBg="hsl(142 60% 85%)"
              scoreText="hsl(142 60% 25%)"
              meta="Today"
              highlight
              delay={400}
              hovered={hovered}
              countDelay={240}
            />
          </Column>

          <Column label="Offer" count={1}>
            <CandidateCard
              avatar={avatarMateoServices}
              name="Mateo S."
              country="Mexico"
              score="Sent"
              scoreBg="hsl(142 60% 85%)"
              scoreText="hsl(142 60% 25%)"
              meta="1d"
              delay={500}
              hovered={hovered}
            />
          </Column>
        </div>

        {/* Footer */}
        <div className="mt-7 pt-5 border-t border-black/[0.06] flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5b3fa3] bg-[#EDE4FF] rounded-full pl-2 pr-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#7c3aed] animate-slow-pulse" />
            AI scored every candidate
          </span>
          <span className="text-[13px] font-bold text-[#0d0d09]">
            Avg. 21d to hire
          </span>
        </div>
      </div>

      {/* Floating "Pipeline live" badge — overlaps bottom edge */}
      <div className="absolute right-6 -bottom-4 z-20 inline-flex items-center gap-2 bg-white text-[#0d0d09] rounded-full pl-2.5 pr-4 py-2 shadow-[0_16px_36px_-12px_rgba(13,13,9,0.25)] ring-1 ring-black/[0.06]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <span className="text-[12.5px] font-semibold tracking-[-0.01em]">
          Pipeline live
        </span>
      </div>
    </div>
  )
}

export default PipelineProductGraphic
