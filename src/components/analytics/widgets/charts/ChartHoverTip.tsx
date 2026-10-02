import { useCallback, useState, type ReactNode, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

export interface TipRow {
  color?: string
  label: string
  value: string
}

export interface TipContent {
  title?: string
  rows: TipRow[]
}

interface TipState {
  x: number
  y: number
  content: TipContent
}

/** Instant, styled hover tooltip that follows the cursor (0ms delay). */
export function useHoverTip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = useCallback((e: MouseEvent, content: TipContent) => {
    setTip({ x: e.clientX, y: e.clientY, content })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  const node: ReactNode = tip ? <HoverTip {...tip} /> : null
  return { show, hide, node, active: tip }
}

function HoverTip({ x, y, content }: TipState) {
  const flipX = typeof window !== 'undefined' && x > window.innerWidth - 220
  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] min-w-[120px] max-w-[260px] rounded-[10px] border border-[#E7E8EE] bg-white px-3 py-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)]"
      style={{
        left: flipX ? undefined : x + 14,
        right: flipX ? window.innerWidth - x + 14 : undefined,
        top: y + 14,
      }}
    >
      {content.title && (
        <div className="mb-1 text-[11px] font-poppins font-semibold text-[#0d0d09] truncate">{content.title}</div>
      )}
      <div className="flex flex-col gap-0.5">
        {content.rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px] font-inter">
            {r.color && <span className="h-2 w-2 rounded-[2px] flex-shrink-0" style={{ background: r.color }} />}
            <span className="flex-1 text-[#5A6072] truncate">{r.label}</span>
            <span className="font-poppins font-semibold tabular-nums text-[#0d0d09]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
