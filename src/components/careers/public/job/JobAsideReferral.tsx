import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  slug: string
  amount?: number | null
  currency?: string | null
}

export function JobAsideReferral({ slug, amount, currency }: Props) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    const url = `${window.location.origin}/p/${slug}?ref=public`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Referral link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const bonus = amount
    ? `$${amount.toLocaleString()} ${currency && currency !== 'USD' ? currency : ''}`.trim()
    : null

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 space-y-2.5">
      <div className="font-poppins font-semibold text-[13px] text-[#0d0d09]">Know someone great?</div>
      <p className="text-[12px] text-[#5a6072] leading-snug">
        {bonus
          ? `We pay a ${bonus} referral bonus on every hire — including from people outside the company.`
          : 'Share this role with someone who would love it.'}
      </p>
      <button
        onClick={handleCopy}
        className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-white border border-black/10 text-[12.5px] font-poppins font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy referral link'}
      </button>
    </div>
  )
}
