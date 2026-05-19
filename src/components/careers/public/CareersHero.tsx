import { ArrowDown, Play, Globe } from 'lucide-react'

interface Props {
  openRolesCount: number
  departmentsCount: number
  companyName: string
  headerText: string | null
  onScrollToRoles: () => void
}

export function CareersHero({ openRolesCount, departmentsCount, companyName, headerText, onScrollToRoles }: Props) {
  return (
    <section className="border-b border-black/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full bg-white border border-black/10 text-[12px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[#0d0d09] font-medium">We're hiring</span>
            <span className="text-[#5a6072]">·</span>
            <span className="text-[#5a6072]">
              {openRolesCount} role{openRolesCount === 1 ? '' : 's'} across {departmentsCount} department{departmentsCount === 1 ? '' : 's'}
            </span>
          </div>

          <h1 className="font-poppins font-bold text-[#0d0d09] text-[44px] sm:text-[56px] lg:text-[68px] leading-[1.02] tracking-[-0.04em]">
            Help us build the<br />
            modern <span className="italic font-serif font-normal" style={{ fontFamily: 'Instrument Serif, Cormorant, Georgia, serif' }}>hiring stack</span><span className="text-[hsl(var(--purple-period))]">.</span>
          </h1>

          <p className="text-[15px] text-[#3f4451] leading-relaxed max-w-xl">
            {headerText ||
              `We started ${companyName} because hiring is too important to be slow, biased, or boring. Today we power hiring for teams worldwide — and we're growing the team that ships the next decade of it.`}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onScrollToRoles}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0d0d09] text-[#FFFCF9] text-[13px] font-poppins font-medium hover:bg-black transition-colors"
            >
              See open roles
              <ArrowDown className="h-4 w-4" />
            </button>
            <button className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white border border-black/10 text-[13px] font-poppins font-medium text-[#0d0d09] hover:bg-[#FAFAF7]">
              Life at {companyName} · 90s
              <Play className="h-3.5 w-3.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-5 space-y-4 lg:pt-10">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="OPEN ROLES" value={String(openRolesCount)} sub={`across ${departmentsCount} department${departmentsCount === 1 ? '' : 's'}`} />
            <StatCard label="AVG FIRST REPLY" value="48h" valueSuffix=" median" sub="we promise ≤ 48h on every role" />
          </div>
          <div className="rounded-2xl bg-[#0d0d09] text-[#FFFCF9] p-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[14px] font-poppins font-semibold tracking-[-0.01em]">
                  Remote-first, with a global team
                </div>
                <div className="text-[12.5px] text-white/65 mt-1 leading-relaxed">
                  Quarterly offsites · 4 weeks PTO · 16 weeks parental leave · real equity.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value, valueSuffix, sub }: { label: string; value: string; valueSuffix?: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white border border-black/5 p-5">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#8B8F9E] font-medium">{label}</div>
      <div className="mt-2 font-poppins font-bold text-[#0d0d09] text-[32px] leading-none tracking-[-0.03em]">
        {value}
        {valueSuffix && <span className="text-[16px] font-medium text-[#5a6072] ml-1">{valueSuffix}</span>}
      </div>
      <div className="mt-2 text-[11.5px] text-[#5a6072]">{sub}</div>
    </div>
  )
}
