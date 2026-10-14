import { cn } from '@/lib/utils'
import { ReferencesGlyph } from './ReferencesGlyph'

/**
 * The module glyphs (exact 48×48 brand geometry), shared by the desktop rail
 * and the phone's bottom bar. Main shapes use `currentColor`; the accent shape
 * carries the `accent` class so the surrounding tile turns it lilac on
 * hover/active (`[&_.accent]:fill-[#D7C5FB]`). At rest it inherits
 * `currentColor`: signal off.
 */
export type ModuleGlyph = (props: { className?: string }) => JSX.Element

export const DashboardGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <circle className="accent" cx="13.5" cy="13.5" r="4.5" fill="currentColor" />
    <rect x="22" y="9" width="17" height="9" rx="4.5" fill="currentColor" />
    <rect x="9" y="21.5" width="30" height="9" rx="4.5" fill="currentColor" />
    <rect x="9" y="34" width="21" height="9" rx="4.5" fill="currentColor" />
  </svg>
)

export const AtsGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <circle cx="24" cy="19.4" r="9.9" fill="currentColor" />
    <rect className="accent" x="20.7" y="29.9" width="13.2" height="8.8" rx="4.4" fill="currentColor" />
  </svg>
)

export const CrmGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <rect x="8.5" y="14.5" width="22" height="9" rx="4.5" fill="currentColor" />
    <rect className="accent" x="17.5" y="26.5" width="22" height="9" rx="4.5" fill="currentColor" />
  </svg>
)

export const ChatGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <rect x="8" y="9" width="32" height="22" rx="9" fill="currentColor" />
    <circle className="accent" cx="13.5" cy="36.5" r="3.6" fill="currentColor" />
  </svg>
)

export const AnalyticsGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <rect x="9" y="25" width="9" height="14" rx="4.5" fill="currentColor" />
    <rect x="19.5" y="19" width="9" height="20" rx="4.5" fill="currentColor" />
    <rect x="30" y="18" width="9" height="21" rx="4.5" fill="currentColor" />
    <circle className="accent" cx="34.5" cy="10" r="4.5" fill="currentColor" />
  </svg>
)

/**
 * People & Access (Circle): three equal dots in a triangle; the top dot is the
 * signal. Exact geometry from the brand spec (Allan, 2026-10-14). Don't redraw.
 */
export const PeopleGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <circle cx="15.5" cy="30.5" r="7" fill="currentColor" />
    <circle cx="32.5" cy="30.5" r="7" fill="currentColor" />
    <circle className="accent" cx="24" cy="15.5" r="7" fill="currentColor" />
  </svg>
)

/** The same glyph with explicit colours, for surfaces that set them directly (headers, crumbs). */
export function GlyphPeopleAccess({
  size = 24,
  color = 'currentColor',
  accent = '#D7C5FB',
  ...props
}: { size?: number; color?: string; accent?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" {...props}>
      <circle cx="15.5" cy="30.5" r="7" fill={color} />
      <circle cx="32.5" cy="30.5" r="7" fill={color} />
      <circle cx="24" cy="15.5" r="7" fill={accent} />
    </svg>
  )
}

export const ReferencesModuleGlyph: ModuleGlyph = ({ className }) => <ReferencesGlyph className={className} />

