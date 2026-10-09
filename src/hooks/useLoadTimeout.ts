import { useEffect, useState } from 'react'

/**
 * §16: true once a first load has been running for `ms` (15s) without an answer, so
 * the view can switch from its skeleton to the error with Retry. Resets when loading
 * stops or `resetKey` changes (a Retry).
 */
export function useLoadTimeout(loading: boolean, resetKey: unknown = 0, ms = 15000) {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    setTimedOut(false)
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), ms)
    return () => clearTimeout(timer)
  }, [loading, resetKey, ms])
  return loading && timedOut
}
