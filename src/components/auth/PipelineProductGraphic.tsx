import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface CandidateRowProps {
  initials: string
  avatarBg: string
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

function CandidateRow({
  initials,
  avatarBg,
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
}: CandidateRowProps) {
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
        const elapsed = ts - start
        const t = Math.min(1, elapsed / duration)
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
        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 bg-white animate-card-rise',
        'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'hover:-translate-y-[2px]',
        highlight
          ? 'ring-1 ring-[#d7c5fb] shadow-[0_8px_24px_-12px_rgba(215,197,251,0.85)]'
          : 'ring-1 ring-black/5',
      ].join(' ')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-[10.5px] font-semibold text-white shrink-0"
        style={{ background: avatarBg }}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[#0d0d09] leading-tight truncate">
          {name}
        </div>
        <div className="text-[10.5px] text-[#5A6072] leading-tight truncate">
          {country}
        </div>
      </div>
      <div
        className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 tabular-nums shrink-0"
        style={{ background: scoreBg, color: scoreText }}
      >
        {isNumeric ? `${display}%` : score}
      </div>
      <div className="text-[10.5px] text-[#8B8F9E] tabular-nums shrink-0 w-9 text-right">
        {meta}
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
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between px-1 mb-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A6072]">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-[#8B8F9E] tabular-nums">
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

export function PipelineProductGraphic() {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative w-full max-w-[560px] mx-auto" aria-hidden={false}>
      {/* Decorative shapes */}
      <div
        aria-hidden
        className="absolute -top-4 right-6 w-16 h-16 rounded-full bg-[#0d0d09] z-0 animate-float-soft"
      />
      <div
        aria-hidden
        className="absolute -top-2 right-20 w-56 h-56 rounded-full bg-[#d6e6ff] z-0 animate-float-soft"
        style={{ animationDelay: '1.2s' }}
      />

      {/* Card */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative z-10 bg-white rounded-2xl shadow-[0_24px_60px_-24px_rgba(13,13,9,0.18)] ring-1 ring-black/5 p-5 animate-panel-rise"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-poppins font-semibold text-[13.5px] text-[#0d0d09] tracking-[-0.02em]">
            Account Executive · Pipeline
          </h3>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/70 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-3 gap-3">
          <Column label="Screening" count={3}>
            <CandidateRow
              initials="DO"
              avatarBg="linear-gradient(135deg,#7c3aed,#a78bfa)"
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
            <CandidateRow
              initials="MA"
              avatarBg="linear-gradient(135deg,#2563eb,#60a5fa)"
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
            <CandidateRow
              initials="SB"
              avatarBg="linear-gradient(135deg,#16a34a,#4ade80)"
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
            <CandidateRow
              initials="MS"
              avatarBg="linear-gradient(135deg,#0d9488,#5eead4)"
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
        <div className="mt-5 pt-4 border-t border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#0d0d09]">
            <Sparkles className="h-3.5 w-3.5 text-[#d7c5fb] animate-slow-pulse" />
            AI-scored
          </div>
          <div className="text-[11px] text-[#5A6072]">
            Avg. time to hire · 18 days
          </div>
        </div>
      </div>

      {/* Floating live badge */}
      <div className="absolute right-4 -bottom-4 z-20 inline-flex items-center gap-1.5 bg-[#0d0d09] text-white rounded-full pl-2 pr-3 py-1.5 shadow-[0_12px_32px_-12px_rgba(13,13,9,0.4)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]">
          Pipeline live
        </span>
      </div>
    </div>
  )
}

export default PipelineProductGraphic
