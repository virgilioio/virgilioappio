import { cn } from '@/lib/utils'

interface BrandDotProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  className?: string
}

const SIZE_PX: Record<NonNullable<BrandDotProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 32,
}

/**
 * Tiny inline brand loader — single pulsing #0d0d09 dot.
 * Use for in-page waits (auth-route session checks, sub-page data, AI thinking).
 * For full-screen app boot, use <GioSplash /> instead.
 */
export function BrandDot({ size = 'md', message, className }: BrandDotProps) {
  const px = SIZE_PX[size]
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <span
        aria-hidden="true"
        className="brand-dot-pulse rounded-full"
        style={{
          width: px,
          height: px,
          backgroundColor: '#0d0d09',
          display: 'inline-block',
        }}
      />
      {message && (
        <p className="text-[13px] font-inter text-muted-foreground">{message}</p>
      )}
      <style>{`
        @keyframes brand-dot-pulse-kf {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.35; transform: scale(0.82); }
        }
        .brand-dot-pulse {
          animation: brand-dot-pulse-kf 1.4s ease-in-out infinite;
          will-change: opacity, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-dot-pulse { animation: none; opacity: 0.85; }
        }
      `}</style>
    </div>
  )
}
