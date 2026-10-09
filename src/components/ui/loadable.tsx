import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Motion & Feel §6 (CLAUDE.md): a content area that loads shows a skeleton the size of
 * the real content, and the content crossfades in on top of it (--dur-switch), so there
 * is no layout shift. Fast loads (under 120ms) never flash the skeleton.
 */

/** Delays visual feedback, never the query or its loading predicate. */
export function useDelayedFlag(value: boolean, delay = 120) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!value) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return value && visible
}

// React 18 has no typed `inert` prop; an empty string renders the attribute.
const inert = (on: boolean) => (on ? ({ inert: '' } as Record<string, string>) : {})

export function Loadable({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
  className?: string
}) {
  const delayed = useDelayedFlag(loading)
  const [shown, setShown] = useState(false)
  const [retained, setRetained] = useState(false)
  useLayoutEffect(() => {
    if (loading) {
      setShown(false)
      setRetained(false)
    }
  }, [loading])
  useLayoutEffect(() => {
    if (delayed) {
      setShown(true)
      setRetained(true)
    }
  }, [delayed])
  const placeholder = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  useLayoutEffect(() => {
    if (!loading || !placeholder.current) return
    const element = placeholder.current
    const measure = () => setHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading])
  return (
    <div
      className={cn('gio-loadable', className)}
      style={height === undefined || !loading ? undefined : { minHeight: height }}
      aria-busy={loading}
      data-fade={(!loading && shown) || undefined}
    >
      <div
        ref={placeholder}
        className="gio-loadable-placeholder"
        aria-hidden="true"
        {...inert(true)}
        data-visible={delayed || undefined}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === 'opacity' && !loading) setRetained(false)
        }}
      >
        {loading || retained ? skeleton : null}
      </div>
      <div
        className="gio-loadable-content"
        {...inert(loading)}
        aria-hidden={loading || undefined}
        data-visible={!loading || undefined}
      >
        {!loading ? children : null}
      </div>
    </div>
  )
}
