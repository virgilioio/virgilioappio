import { forwardRef, SVGProps } from 'react'

export interface GioGlyphProps extends Omit<SVGProps<SVGSVGElement>, 'height' | 'width'> {
  size?: number
}

/**
 * The Gio Glyph: the dot and pill of the logomark on their own (Allan,
 * 2026-10-28). Where Gio appears as itself next to another product (an
 * integration's Connect dialog, Gio's messages in Slack), never the old avatar.
 * Uses `currentColor`; noir by default.
 */
export const GioGlyph = forwardRef<SVGSVGElement, GioGlyphProps>(({ size = 24, className, style, ...rest }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 27 20.4 29.7"
    width={(size * 20.4) / 29.7}
    height={size}
    className={className}
    style={{ color: '#0d0d09', ...style }}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="10.195" cy="37.191" r="9.895" />
    <rect x="6.863" y="47.578" width="13.231" height="8.832" rx="4.416" />
  </svg>
))
GioGlyph.displayName = 'GioGlyph'

export default GioGlyph
