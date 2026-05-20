import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tagColorClasses } from '@/hooks/useTags'

interface TagChipProps {
  name: string
  color?: string | null
  size?: 'sm' | 'md'
  onRemove?: () => void
  onClick?: () => void
  className?: string
}

export function TagChip({ name, color, size = 'sm', onRemove, onClick, className }: TagChipProps) {
  const c = tagColorClasses(color)
  const isInteractive = !!onClick
  const Comp: any = isInteractive ? 'button' : 'span'
  return (
    <Comp
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-inter',
        size === 'sm' ? 'h-[22px] px-2 text-[11.5px]' : 'h-[26px] px-2.5 text-[12px]',
        c.chip, c.text,
        isInteractive && 'hover:brightness-95 transition',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.dot)} />
      <span className="truncate max-w-[160px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="ml-0.5 -mr-0.5 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center hover:bg-black/10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </Comp>
  )
}
