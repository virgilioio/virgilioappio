import { useEffect, useRef, useState } from 'react'
import { motionToken } from '@/lib/motion'

export type AsyncCheckResult = { ok: boolean; message: string } | null

export type AsyncValidationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid' | 'invalid'; message: string }

/**
 * Motion & Feel §12 async validation: runs `check` --delay-validate (400ms) after the
 * value stops changing, never on every keystroke. A newer value aborts the older check,
 * and its late answer is ignored. `check` returns null for "nothing to say" (empty or
 * not checkable yet), or { ok, message }. A failed request says nothing rather than
 * showing a raw server error. Pair with <AsyncStatus state={…} checking="…" />.
 *
 * `key` is what identifies the value (a string, or a joined list); `check` reads the
 * latest closure, so it doesn't need to be stable.
 */
export function useAsyncValidation(
  key: string,
  check: (signal: AbortSignal) => Promise<AsyncCheckResult>,
  { enabled = true }: { enabled?: boolean } = {},
): AsyncValidationState {
  const [state, setState] = useState<AsyncValidationState>({ status: 'idle' })
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    if (!enabled || !key) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState({ status: 'checking' })
      try {
        const result = await checkRef.current(controller.signal)
        if (controller.signal.aborted) return
        setState(result ? { status: result.ok ? 'valid' : 'invalid', message: result.message } : { status: 'idle' })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'idle' })
      }
    }, motionToken('--delay-validate', 400))
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled])

  return state
}
