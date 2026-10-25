import { useId } from 'react'
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

/** Inbox: a tray with a dip; the letter dropping into it is the signal. */
export const InboxGlyph: ModuleGlyph = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <path
      d="M8 26.5a2.5 2.5 0 0 1 2.5-2.5H17a7 7 0 0 0 14 0h6.5a2.5 2.5 0 0 1 2.5 2.5V32a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z"
      fill="currentColor"
    />
    <circle className="accent" cx="24" cy="12.5" r="4.5" fill="currentColor" />
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


/**
 * Sign ("Meet"): a soft square (the document) overlaps a disc (the signer);
 * only the shared area is the signal. Exact geometry from the glyph prompt
 * (Allan, 2026-10-16). Don't redraw.
 *
 * The rail's inactive colour is translucent (72% opaline), so drawing the
 * square and the disc as two shapes would make their overlap brighter. Here the
 * silhouette is one fill cut by a mask of both shapes, and the overlap is a
 * separate accent layer that's invisible at rest and lilac on hover/active.
 * Each copy gets its own ids, so the rail and a page header can show it at once.
 */
export const SignGlyph: ModuleGlyph = ({ className }) => {
  const id = 'sign-' + useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
      <mask id={`${id}-shape`} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect x="8" y="15" width="25" height="25" rx="7.5" fill="#fff" />
        <circle cx="31" cy="17" r="10" fill="#fff" />
      </mask>
      <clipPath id={`${id}-disc`}>
        <circle cx="31" cy="17" r="10" />
      </clipPath>
      <rect width="48" height="48" fill="currentColor" mask={`url(#${id}-shape)`} />
      <rect className="accent" x="8" y="15" width="25" height="25" rx="7.5" fill="none" clipPath={`url(#${id}-disc)`} />
    </svg>
  )
}

/** The Sign glyph with explicit colours, exactly as the glyph prompt gives it. */
export function GlyphSign({
  size = 24,
  color = 'currentColor',
  accent = '#D7C5FB',
  ...props
}: { size?: number; color?: string; accent?: string } & React.SVGProps<SVGSVGElement>) {
  const clip = 'sign-' + useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" {...props}>
      <clipPath id={clip}>
        <circle cx="31" cy="17" r="10" />
      </clipPath>
      <rect x="8" y="15" width="25" height="25" rx="7.5" fill={color} />
      <circle cx="31" cy="17" r="10" fill={color} />
      <rect x="8" y="15" width="25" height="25" rx="7.5" fill={accent} clipPath={`url(#${clip})`} />
    </svg>
  )
}

/** Every module glyph by key, so a new module is one line. */
export const MODULE_GLYPHS = {
  home: DashboardGlyph,
  ats: AtsGlyph,
  crm: CrmGlyph,
  chat: ChatGlyph,
  inbox: InboxGlyph,
  references: ReferencesModuleGlyph,
  analytics: AnalyticsGlyph,
  people: PeopleGlyph,
  sign: SignGlyph,
} satisfies Record<string, ModuleGlyph>
