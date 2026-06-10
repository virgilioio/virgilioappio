import { ArrowRight, Heart } from 'lucide-react'
import heroPortrait from '@/assets/virgilio-careers-hero.jpg'

interface Props {
  openRolesCount: number
  departmentsCount: number
  onScrollToRoles: () => void
}

export function VirgilioCareersHero({ departmentsCount, onScrollToRoles }: Props) {
  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 lg:pt-16 pb-16 lg:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left */}
        <div className="lg:col-span-7 space-y-8">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 text-[11.5px] font-poppins font-medium uppercase tracking-[0.16em] text-[#5a6072]">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--virgilio-purple))]" />
            Careers at Virgilio <span className="text-[#b8bcc6]">·</span> Remote-first
          </div>

          {/* Headline */}
          <h1 className="font-poppins font-bold text-[#0d0d09] text-[52px] sm:text-[68px] lg:text-[84px] leading-[0.98] tracking-[-0.045em]">
            Come build the future of{' '}
            <span
              className="italic font-normal"
              style={{ fontFamily: 'Instrument Serif, Cormorant, Georgia, serif' }}
            >
              hiring
            </span>
            <span className="text-[hsl(var(--purple-period))]">.</span>
          </h1>

          {/* Subtext */}
          <p className="text-[16px] text-[#3f4451] leading-relaxed max-w-xl">
            We're a people company, building the modern way to hire. If you care about doing hiring right — fast, fair, and human — there's a seat for you here.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={onScrollToRoles}
              className="group inline-flex items-center gap-3 h-14 pl-6 pr-2 rounded-full bg-[#0d0d09] text-[#FFFCF9] text-[14px] font-poppins font-medium hover:bg-black transition-colors"
            >
              See open roles
              <span className="h-10 w-10 rounded-full bg-[#FFFCF9] text-[#0d0d09] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
            <a
              href="#why-virgilio"
              className="group inline-flex items-center gap-3 h-14 pl-6 pr-2 rounded-full bg-transparent border border-[#0d0d09]/15 text-[#0d0d09] text-[14px] font-poppins font-medium hover:bg-white transition-colors"
            >
              Why Virgilio
              <span className="h-10 w-10 rounded-full bg-[#0d0d09] text-[#FFFCF9] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </a>
          </div>

          {/* Stats strip */}
          <div className="flex items-start gap-10 pt-6">
            <Stat value="Remote" sub="Fully distributed" />
            <Stat value="48h" sub="We always reply" />
            <Stat
              value={String(Math.max(departmentsCount, 1))}
              sub={`Team${departmentsCount === 1 ? '' : 's'} & growing`}
            />
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-5 relative">
          <div className="relative max-w-[460px] mx-auto">
            {/* Decorative shapes */}
            <div className="absolute -top-6 -left-6 h-16 w-16 rounded-full bg-[#0d0d09] z-10" />
            <div className="absolute -top-10 right-6 h-28 w-28 rounded-full bg-[hsl(var(--virgilio-purple))]/40" />

            {/* Portrait */}
            <div className="relative rounded-[28px] overflow-hidden bg-[#C8A582] aspect-[4/5] shadow-[0_30px_80px_-30px_rgba(13,13,9,0.35)]">
              <img
                src={heroPortrait}
                alt="A member of the Virgilio team"
                className="w-full h-full object-cover"
              />

              {/* Floating: We're hiring */}
              <div className="absolute top-5 right-5 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white shadow-[0_8px_24px_-8px_rgba(13,13,9,0.25)] text-[12.5px] font-poppins font-medium text-[#0d0d09]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                We're hiring
              </div>
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-8 -left-6 w-[260px] bg-white rounded-2xl p-4 shadow-[0_20px_50px_-15px_rgba(13,13,9,0.25)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[hsl(var(--virgilio-purple))]/15 flex items-center justify-center shrink-0">
                  <Heart className="h-4 w-4 text-[hsl(var(--virgilio-purple))] fill-[hsl(var(--virgilio-purple))]" />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-poppins font-semibold text-[#0d0d09]">Every applicant</div>
                  <div className="text-[12px] text-[#5a6072]">hears back from us</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/5 flex items-end justify-between">
                <div>
                  <div className="text-[9.5px] uppercase tracking-[0.12em] text-[#8B8F9E] font-medium">Avg. first reply</div>
                  <div className="mt-0.5 font-poppins font-bold text-[#0d0d09] text-[22px] leading-none tracking-[-0.02em]">48h</div>
                </div>
                <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-poppins font-medium border border-emerald-200/60">
                  No ghosting
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ value, sub }: { value: string; sub: string }) {
  return (
    <div>
      <div className="font-poppins font-bold text-[#0d0d09] text-[28px] leading-none tracking-[-0.03em]">{value}</div>
      <div className="mt-2 text-[12px] text-[#5a6072]">{sub}</div>
    </div>
  )
}
