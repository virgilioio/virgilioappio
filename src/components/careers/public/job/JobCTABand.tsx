import { ArrowRight } from 'lucide-react'

interface Props {
  onApply: () => void
  responseHours?: number
}

export function JobCTABand({ onApply, responseHours = 48 }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="rounded-2xl bg-[#0d0d09] text-[#FFFCF9] px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="font-poppins font-semibold text-[16px] tracking-[-0.01em]">Ready when you are.</div>
          <div className="text-[12.5px] text-white/70 mt-0.5">
            A short application and your resume — we'll reply within {responseHours} hours.
          </div>
        </div>
        <button
          onClick={onApply}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-white text-[#0d0d09] text-[13px] font-poppins font-medium hover:bg-[#FAFAF7]"
        >
          Apply now
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
