import { useEffect, useRef } from 'react'

/**
 * Motion & Feel §9 (CLAUDE.md): keep the scroll position for each tab, filter and route.
 * `key` names the view (route + tab + filters); `ready` turns true once its rows are on
 * screen. The position is saved as you scroll (per browser tab, sessionStorage) and
 * restored once, without animation, the first time that view is ready again.
 */
const PREFIX = 'gio.scroll.'

function read(key: string): number | null {
  try {
    const v = sessionStorage.getItem(PREFIX + key)
    return v == null ? null : Number(v)
  } catch {
    return null
  }
}
function write(key: string, top: number) {
  try {
    sessionStorage.setItem(PREFIX + key, String(Math.round(top)))
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

export function useScrollMemory(container: { current: HTMLElement | null }, key: string, ready: boolean) {
  const restored = useRef<string | null>(null)

  // Save while scrolling (once per frame).
  useEffect(() => {
    const el = container.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => write(key, el.scrollTop))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [container, key])

  // Restore once per key, when the content is there.
  useEffect(() => {
    if (!ready || restored.current === key) return
    const el = container.current
    if (!el) return
    restored.current = key
    const top = read(key)
    if (top == null || top <= 0) return
    // Content that is still loading may not be tall enough yet: keep trying as it grows
    // (up to 3s), and stop as soon as the person scrolls themselves.
    let done = false
    const attempt = () => {
      if (done) return
      el.scrollTop = top
      if (Math.abs(el.scrollTop - top) <= 1) stop()
    }
    const observer = new ResizeObserver(attempt)
    const stop = () => {
      done = true
      observer.disconnect()
      clearTimeout(timer)
      el.removeEventListener('wheel', stop)
      el.removeEventListener('touchstart', stop)
    }
    const timer = setTimeout(stop, 3000)
    el.addEventListener('wheel', stop, { passive: true })
    el.addEventListener('touchstart', stop, { passive: true })
    Array.from(el.children).forEach((child) => observer.observe(child))
    requestAnimationFrame(attempt)
    return stop
  }, [container, key, ready])
}

/** Remember a small value (e.g. how many "load more" pages are open) for a view. */
export function rememberValue(key: string, value: number) {
  write(`v.${key}`, value)
}
export function recallValue(key: string): number | null {
  return read(`v.${key}`)
}
