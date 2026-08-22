import React from 'react'

/**
 * Prop-based reference glyph for pills and tiles.
 * The rail glyph (currentColor + .accent class) lives in
 * src/components/icons/ReferencesGlyph.tsx — both are intentional.
 *
 * The mask is load-bearing and the six geometry numbers are fixed.
 */
export function RefGlyph({
  size = 24,
  color = 'currentColor',
  accent = '#D7C5FB',
}: {
  size?: number
  color?: string
  accent?: string
}) {
  const uid = React.useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <mask id={uid} maskUnits="userSpaceOnUse">
        <rect width="48" height="48" fill="#fff" />
        <circle cx="16.5" cy="24" r="13.5" fill="#000" />
      </mask>
      <circle cx="31.5" cy="24" r="11.5" fill={color} mask={`url(#${uid})`} />
      <circle cx="16.5" cy="24" r="11.5" fill={accent} />
    </svg>
  )
}

export default RefGlyph
