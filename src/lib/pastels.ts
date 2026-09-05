/**
 * Shared pastel tones for the pipeline segmented control and any surface that
 * needs the same section colours. Reference these — never re-type the hexes.
 */

export interface PastelTone {
  bg: string
  fg: string
}

export const PASTELS: Record<string, PastelTone> = {
  lilac: { bg: '#E9DEFE', fg: '#5B21B6' },
  purple: { bg: '#EDE4FF', fg: '#5B21B6' },
  yellow: { bg: '#FEF3C7', fg: '#92400E' },
  blue: { bg: '#DBEAFE', fg: '#1E40AF' },
  green: { bg: '#D1FAE5', fg: '#065F46' },
  neutral: { bg: '#F1F0EC', fg: '#5A6072' },
}

/** Neutral chrome used alongside the pastels. */
export const INK = '#0d0d09'
export const CREAM = '#fffcf9'
export const HAIRLINE = '#E7E8EE'
export const SAND = '#F1F0EC'
export const SURFACE_HOVER = '#FAFAF7'
export const MUTED = '#5A6072'
export const TERTIARY = '#8B8F9E'
export const PURPLE = '#6F3FF5'
