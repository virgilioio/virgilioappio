import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { loadTemplatePdf } from '@/lib/sign/pdf'
import type { TplDoc } from '@/lib/sign/templates'

/* eslint-disable react-refresh/only-export-components */
/** A role's colour as a see-through fill and as an edge (shared by the editor and previews). */
export function tint(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return `rgba(255,255,255,${a})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
/** The role colour, darker, for the field's outline. */
export const edge = (hex: string) => `color-mix(in srgb, ${hex} 55%, #0d0d09)`

/**
 * One page of a template document, drawn when it scrolls into view, with
 * whatever is overlaid on it (fields in the editor, values in a preview).
 */
export function PdfPage({ doc, index, width, children }: { doc: TplDoc; index: number; width: number; children?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'idle' | 'ready' | 'error'>('idle')
  const size = doc.page_sizes[index] ?? { w: 612, h: 792 }
  const bucket = Math.ceil(width / 240)

  useEffect(() => {
    const el = box.current
    if (!el) return
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    let done = false
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || done) return
        done = true
        io.disconnect()
        try {
          const pdf = await loadTemplatePdf(doc)
          const page = await pdf.getPage(index + 1)
          const c = canvas.current
          if (!c) return
          const base = page.getViewport({ scale: 1 })
          const scale = (Math.max(el.clientWidth, bucket * 240) / base.width) * Math.min(2, window.devicePixelRatio || 1)
          const vp = page.getViewport({ scale })
          const off = document.createElement('canvas')
          off.width = Math.floor(vp.width)
          off.height = Math.floor(vp.height)
          task = page.render({ canvasContext: off.getContext('2d')!, viewport: vp }) as unknown as typeof task
          await task!.promise
          // Swap in one step, so a zoom never flashes a blank page.
          c.width = off.width
          c.height = off.height
          c.getContext('2d')!.drawImage(off, 0, 0)
          setState('ready')
        } catch (e) {
          if ((e as { name?: string })?.name !== 'RenderingCancelledException') setState('error')
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [doc, index, bucket])

  return (
    <div ref={box} className="gio-sign-page" style={{ width, aspectRatio: `${size.w} / ${size.h}` }}>
      {state === 'idle' && <Skeleton className="absolute inset-[7%] rounded-md opacity-60" />}
      {state === 'error' && (
        <p className="absolute inset-x-0 top-1/3 text-center font-inter text-[12.5px] text-virgilio-error">This page couldn’t be drawn. Close and open the template again.</p>
      )}
      <canvas ref={canvas} data-ready={state === 'ready' || undefined} aria-hidden />
      {children}
    </div>
  )
}

