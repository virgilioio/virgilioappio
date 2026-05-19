import { ArrowRight } from 'lucide-react'

interface Props { companyName: string }

export function CareersOpenApplicationBand({ companyName }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="rounded-2xl bg-[#0d0d09] text-[#FFFCF9] p-8 lg:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-xl">
          <h3 className="font-poppins font-bold text-[24px] lg:text-[28px] tracking-[-0.02em]">
            Don't see your role<span className="text-[hsl(var(--purple-period))]">?</span>
          </h3>
          <p className="text-[13.5px] text-white/65 mt-2 leading-relaxed">
            We're always interested in talking to thoughtful people. Send us a note about what you'd want to work on at {companyName} — a real person reads every one.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-[#0d0d09] text-[13px] font-poppins font-medium hover:bg-[#FAFAF7] shrink-0">
          Send an open application
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
