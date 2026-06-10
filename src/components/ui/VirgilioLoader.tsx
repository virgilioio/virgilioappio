import { cn } from '@/lib/utils'
import logomark from '@/assets/virgilio-logomark.svg.asset.json'

interface VirgilioLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  className?: string
}

const SIZE_PX: Record<NonNullable<VirgilioLoaderProps['size']>, number> = {
  sm: 32,
  md: 56,
  lg: 80,
}

export function VirgilioLoader({ size = 'md', message, className }: VirgilioLoaderProps) {
  const px = SIZE_PX[size]
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <img
        src={logomark.url}
        alt="Loading"
        width={px}
        height={px}
        className="animate-logo-fade select-none"
        style={{ width: px, height: px }}
        draggable={false}
      />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
