import { useEffect, useRef, useState } from 'react'

/**
 * Stretches a transient `active` flag so it stays true for at least `minMs`
 * after it first flips. Prevents skeleton/spinner flicker on fast responses.
 *
 *   const isRunning = useMinimumDuration(query.isFetching, 280)
 */
export function useMinimumDuration(active: boolean, minMs = 280): boolean {
  const [held, setHeld] = useState(active)
  const startedAt = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (active) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      if (startedAt.current == null) startedAt.current = Date.now()
      setHeld(true)
      return
    }
    if (startedAt.current == null) {
      setHeld(false)
      return
    }
    const elapsed = Date.now() - startedAt.current
    const remaining = Math.max(0, minMs - elapsed)
    timer.current = setTimeout(() => {
      startedAt.current = null
      setHeld(false)
    }, remaining)
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  }, [active, minMs])

  return held
}
