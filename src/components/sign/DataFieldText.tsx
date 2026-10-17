import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { LINE_HEIGHT, layoutText, measurePt } from '@/lib/sign/textLayout'

/**
 * A data field's value as it will print: wrapped, shrunk and cut exactly like
 * the sealed PDF (shared layout), or a tick for a yes/no field shown as one.
 * Sits inside the field's box on a page that is a size container (cqw).
 */
export function DataFieldText({
  value,
  tick,
  w,
  h,
  page,
  fontSize,
  empty,
  mark,
}: {
  value: string | null | undefined
  tick?: boolean
  /** The box, in % of the page. */
  w: number
  h: number
  /** The page, in points. */
  page: { w: number; h: number }
  fontSize?: number | null
  /** What to show when nothing will print (the sender's preview); nothing by default. */
  empty?: string
  /** The send sheet's preview: the value gets a lilac underline (2026-10-17). */
  mark?: boolean
}) {
  const pageW = page.w || 612
  const pageH = page.h || 792
  const text = String(value ?? '')
  const layout = useMemo(
    () => (tick || !text.trim() ? null : layoutText(text, (w / 100) * pageW - 2, (h / 100) * pageH, measurePt, fontSize)),
    [tick, text, w, h, pageW, pageH, fontSize],
  )
  if (tick) {
    return value === 'Yes' ? (
      <span className="absolute inset-0 flex items-center justify-center" aria-label="Ticked">
        <Check className="h-[80%] w-[80%]" strokeWidth={2.2} aria-hidden />
      </span>
    ) : null
  }
  if (!layout) return empty ? <span className="truncate px-[0.2cqw] text-text-tertiary">{empty}</span> : null
  const cq = (pt: number) => `${(pt / pageW) * 100}cqw`
  return (
    <span
      className="absolute inset-0 overflow-hidden"
      style={{
        // The PDF's own font and weight, so lines break where they print.
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontWeight: 400,
        letterSpacing: 'normal',
        fontSize: cq(layout.size),
        lineHeight: LINE_HEIGHT,
        paddingLeft: cq(1),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: layout.lines.length === 1 ? 'center' : 'flex-start',
        color: '#0d0d09',
        textShadow: 'none',
      }}
    >
      {layout.lines.map((line, i) => (
        <span key={i} className="block whitespace-pre">
          {mark && line ? <span className="gio-value-mark">{line}</span> : line || ' '}
        </span>
      ))}
    </span>
  )
}
