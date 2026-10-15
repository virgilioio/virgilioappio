import { GioAtsLogo } from '@/components/brand/GioAtsLogo'

interface GoGioLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  className?: string
}

/** Visible height of the mark, in px (the lockup is cropped, so this is the real size). */
const SIZE_MAP = {
  sm: 20,
  md: 24,
  lg: 30,
  xl: 36,
  '2xl': 44,
  '3xl': 56,
} as const

/**
 * Gio ATS brand mark: the gio ats lockup (inline SVG, crisp at every size).
 * Each size is the mark's visible height.
 */
export function GoGioLogo({ size = 'md', className = '' }: GoGioLogoProps) {
  const height = SIZE_MAP[size]

  return (
    <div className={`flex items-center ${className}`}>
      <GioAtsLogo cropped height={height} />
    </div>
  )
}
