import { cn } from '@/lib/utils'

/** Dashed "Draft" pill — used wherever a draft job is listed or shown. */
export function DraftPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border border-dashed border-[#B9B6AC] px-2 font-inter text-[11px] font-semibold leading-none text-[#1F2230]',
        className,
      )}
    >
      Draft
    </span>
  )
}
