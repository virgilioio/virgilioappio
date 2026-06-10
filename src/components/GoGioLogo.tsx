import { GioWordmark } from '@/components/icons/GioWordmark'

interface GoGioLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
} as const

/**
 * Gio brand mark. Renders the inline `<GioWordmark>` SVG so it scales crisply
 * at every size and supports `currentColor` re-tinting via Tailwind `text-*`
 * utilities on the wrapping element.
 */
export function GoGioLogo({ size = 'md', className = '' }: GoGioLogoProps) {
  const height = SIZE_MAP[size]

  return (
    <div className={`flex items-center ${className}`}>
      <GioWordmark height={height} />
    </div>
  )
}
