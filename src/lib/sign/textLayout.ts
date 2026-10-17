/**
 * How a value fits its box, shared with the sealed PDF: the same file
 * sign-seal uses (supabase/functions/_shared/sign/wrap.ts), so the previews
 * wrap and shrink exactly as the printed document does (2026-10-17).
 */
export { LINE_HEIGHT, MIN_SIZE, autoSize, layoutText, type TextLayout } from '../../../supabase/functions/_shared/sign/wrap.ts'

let ctx: CanvasRenderingContext2D | null = null

/** Text width in points at `size` points, measured in Helvetica (Arial has the same widths). */
export function measurePt(text: string, size: number): number {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')
    if (ctx) ctx.font = '100px Helvetica, Arial, sans-serif'
  }
  if (!ctx) return text.length * size * 0.5
  return (ctx.measureText(text).width * size) / 100
}
