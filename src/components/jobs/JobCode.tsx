import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { IconSwap } from '@/components/ui/icon-swap'
import { IconTip } from '@/components/ui/tooltip'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

/**
 * A job's ID (VG-7K3P, `jobs.job_code`) as a small grey chip. On the job page it
 * copies on click (§7 copy chip: the icon swaps to a tick for 1.6s); in a list
 * row it's plain text, so a click still opens the job.
 */
export function JobCode({
  code,
  copyable = false,
  size = 'sm',
  className,
}: {
  code?: string | null
  copyable?: boolean
  size?: 'sm' | 'xs'
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])
  if (!code) return null

  const look = cn(
    'inline-flex shrink-0 items-center gap-1 rounded-md bg-[#F1F0EC] font-inter font-medium tabular-nums text-text-secondary whitespace-nowrap',
    size === 'sm' ? 'h-[22px] px-2 text-[12px]' : 'h-[18px] px-1.5 text-[11px]',
    className,
  )

  if (!copyable) return <span className={look}>{code}</span>

  const copy = async () => {
    if (await copyToClipboardSilent(code)) {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
      toast({ title: `${code} copied` })
    } else {
      toast({ title: "Couldn't copy to the clipboard", variant: 'destructive' })
    }
  }

  return (
    <IconTip label="Copy job ID">
      <button
        type="button"
        onClick={() => void copy()}
        className={cn(look, 'gio-pressable cursor-pointer hover:text-text-primary transition-colors duration-hover')}
      >
        {code}
        <IconSwap
          swapped={copied}
          from={<Copy className="h-3 w-3" strokeWidth={2} />}
          to={<Check className="h-3 w-3" strokeWidth={2} />}
        />
      </button>
    </IconTip>
  )
}
