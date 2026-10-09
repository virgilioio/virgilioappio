import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Motion & Feel §6 KPIs (CLAUDE.md): a number counts up once, on its first view in the
 * session (--dur-countup, ease-out quart). After that a new value never counts again: it
 * blends through blur(2px) + opacity .4 over --dur-menu-in. Reduced motion: no count, the
 * blend keeps only its opacity/filter fade.
 *
 * `id` names the KPI for the "first view this session" check (UI state only, never data).
 * `format` turns the in-flight number into text; strings and null render as they are.
 */

const seen = new Set<string>()
const integer = (value: number) => Math.round(value).toLocaleString('en-US')

type Value = number | string | null | undefined

interface Props {
  id: string
  value: Value
  format?: (value: number) => string
  /** False while the value is still a placeholder; the first real value claims the count. */
  ready?: boolean
  count?: boolean
  title?: string
  className?: string
  children?: ReactNode
}

function ms(element: HTMLElement, token: string, fallback: number) {
  const text = getComputedStyle(element).getPropertyValue(token).trim()
  const n = Number.parseFloat(text) * (text.endsWith('ms') ? 1 : 1000)
  return Number.isFinite(n) ? n : fallback
}

export function BlendNumber({ id, value, format = integer, ready = true, count = true, title, className, children }: Props) {
  const element = useRef<HTMLSpanElement>(null)
  const latest = useRef({ value, children })
  latest.current = { value, children }
  const previous = useRef<{ id: string; value: Value } | undefined>(undefined)
  const [display, setDisplay] = useState<{ value: Value; children?: ReactNode }>({ value, children })
  const [blend, setBlend] = useState(false)

  useEffect(() => {
    const node = element.current
    if (!node || !ready) return
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const finish = () => {
      if (!cancelled) setDisplay({ value: latest.current.value, children: latest.current.children })
    }
    const old = previous.current
    const first = !old || old.id !== id
    previous.current = { id, value }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const realNumber = typeof value === 'number' && Number.isFinite(value) && value !== 0
    const onVisibility = () => {
      if (!document.hidden) return
      cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
      finish()
      setBlend(false)
    }
    document.addEventListener('visibilitychange', onVisibility)

    if (first && realNumber && count && !seen.has(id) && !reduced && !document.hidden) {
      seen.add(id)
      setDisplay({ value: 0, children })
      const run = () => {
        const start = performance.now()
        const duration = ms(node, '--dur-countup', 700)
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          setDisplay({ value: Number(value) * (1 - (1 - t) ** 4), children })
          if (t < 1) frame = requestAnimationFrame(tick)
          else finish()
        }
        frame = requestAnimationFrame(tick)
      }
      // Start after the skeleton-to-content crossfade, not underneath it.
      if (node.closest('.gio-loadable[data-fade]')) timer = setTimeout(run, ms(node, '--dur-switch', 200))
      else run()
    } else if (first) {
      seen.add(id)
      finish()
    } else if (!Object.is(old.value, value)) {
      setBlend(true)
      // Swap the text at the blur's midpoint, then clear it.
      timer = setTimeout(() => {
        finish()
        setBlend(false)
      }, ms(node, '--dur-menu-in', 180) / 2)
    } else {
      finish()
    }
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // children are read through `latest`; only a new value or id restarts the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, value, ready, count])

  const text = (v: Value) => (typeof v === 'number' ? (Number.isFinite(v) ? format(v) : '—') : (v ?? '—'))
  return (
    <span
      ref={element}
      className={cn('gio-blend-number tabular-nums', className)}
      data-blend={blend || undefined}
      title={title}
    >
      <span className="gio-number-reserve" aria-hidden="true">
        {text(value)}
        {children}
      </span>
      <span aria-hidden="true">
        {text(display.value)}
        {display.children}
      </span>
      <span className="sr-only">
        {text(value)}
        {children}
      </span>
    </span>
  )
}
