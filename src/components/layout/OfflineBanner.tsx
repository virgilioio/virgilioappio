import { useEffect, useRef, useState } from 'react'
import { WifiOff, Check } from 'lucide-react'

/**
 * Motion & Feel §5 Offline (CLAUDE.md): when the connection drops, a banner slides
 * over the top of the app (--dur-dialog-in) without pushing anything down. On
 * reconnect it turns green — "Back online. All changes saved." — for 1.5s, then slides
 * away. React Query pauses its mutations while offline and runs them on reconnect.
 */
type BannerState = 'hidden' | 'offline' | 'back'

export function OfflineBanner() {
  const [state, setState] = useState<BannerState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'hidden',
  )
  // What the banner says while it slides away (it keeps its last message).
  const [shownAs, setShownAs] = useState<Exclude<BannerState, 'hidden'>>('offline')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const current = useRef(state)
  current.current = state

  useEffect(() => {
    const goOffline = () => {
      clearTimeout(timer.current)
      setState('offline')
      setShownAs('offline')
    }
    const goOnline = () => {
      if (current.current !== 'offline') return
      clearTimeout(timer.current)
      setState('back')
      setShownAs('back')
      timer.current = setTimeout(() => setState('hidden'), 1500)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      clearTimeout(timer.current)
    }
  }, [])

  const back = shownAs === 'back'
  return (
    <div
      role="status"
      aria-live="polite"
      className="gio-offline-banner"
      data-shown={state !== 'hidden' || undefined}
      style={{ background: back ? '#0B7A52' : '#0d0d09' }}
    >
      <span className="inline-flex items-center gap-2 font-inter text-[12.5px] font-medium text-[#fffcf9]">
        {back ? <Check size={14} strokeWidth={2} aria-hidden /> : <WifiOff size={14} strokeWidth={2} aria-hidden />}
        {back ? 'Back online. All changes saved.' : "You're offline. Changes will save when you're back online."}
      </span>
    </div>
  )
}
