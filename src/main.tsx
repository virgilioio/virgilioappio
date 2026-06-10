import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import App from './App.tsx'
import './index.css'
import { GioSplash } from './components/ui/GioSplash'
import { SplashReadyProvider, useSplashReady } from './contexts/SplashReadyContext'

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

function SplashHost({ enabled }: { enabled: boolean }) {
  const { ready } = useSplashReady()
  if (!enabled) return null
  return <GioSplash show={ready} />
}

function Root() {
  // Show splash only on cold load / hard refresh (once per tab session).
  const [isColdLoad] = useState(() => {
    if (typeof window === 'undefined') return false
    const seen = sessionStorage.getItem('gio-splash-shown')
    if (!seen) sessionStorage.setItem('gio-splash-shown', '1')
    return !seen
  })

  return (
    <SplashReadyProvider initialReady={!isColdLoad}>
      <App />
      <SplashHost enabled={isColdLoad} />
    </SplashReadyProvider>
  )
}

createRoot(document.getElementById("root")!).render(<Root />);
