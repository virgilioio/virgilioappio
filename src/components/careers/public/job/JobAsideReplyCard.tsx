import { Clock, ArrowRight } from 'lucide-react'

interface Props {
  onApply: () => void
  responseHours?: number
  medianHours?: number
  accentColor?: string
}

export function JobAsideReplyCard({ onApply, responseHours = 48, medianHours = 18, accentColor }: Props) {
  const color = accentColor || '#6F3FF5'
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: `${color}26` }}>
          <Clock className="h-4 w-4" style={{ color }} />
        </div>

        <div className="leading-tight">
          <div className="font-poppins font-semibold text-[13px] text-[#0d0d09]">
            Reply in &lt; {responseHours} hours
          </div>
          <div className="text-[11.5px] text-[#5a6072]">Median {medianHours}h — we mean it.</div>
        </div>
      </div>
      <button
        onClick={onApply}
        className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-[#0d0d09] text-[#FFFCF9] text-[13px] font-poppins font-medium hover:bg-black"
      >
        Apply for this role
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <p className="text-[11px] text-[#8B8F9E] text-center">~4 minutes · No account needed</p>
    </div>
  )
}
