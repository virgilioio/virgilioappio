import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import App from './App.tsx'
import './index.css'
import { GioSplash } from './components/ui/GioSplash'

// Dynamically import and init Sentry only in production
if (!import.meta.env.DEV && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      release: import.meta.env.VITE_APP_VERSION || 'unknown',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    })
  })
}

function Root() {
  // Show splash only on cold load / hard refresh (once per tab session).
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem('gio-splash-shown')
  })

  useEffect(() => {
    if (!showSplash) return
    sessionStorage.setItem('gio-splash-shown', '1')
    // Hide once the app has had a chance to render its first frame.
    // GioSplash enforces its own 800ms minimum, so this can be eager.
    const id = window.setTimeout(() => setShowSplash(false), 50)
    return () => window.clearTimeout(id)
  }, [showSplash])

  return (
    <>
      <App />
      {showSplash && <GioSplash show={true} />}
      {!showSplash && <GioSplash show={false} key="splash-exit-noop" />}
    </>
  )
}

createRoot(document.getElementById("root")!).render(<Root />);

