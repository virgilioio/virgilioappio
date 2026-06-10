import { createContext, useCallback, useContext, useState, ReactNode, useEffect } from 'react'

interface SplashReadyContextValue {
  ready: boolean
  setReady: (ready: boolean) => void
}

const SplashReadyContext = createContext<SplashReadyContextValue>({
  ready: true,
  setReady: () => {},
})

interface SplashReadyProviderProps {
  children: ReactNode
  initialReady?: boolean
}

export function SplashReadyProvider({ children, initialReady = false }: SplashReadyProviderProps) {
  const [ready, setReadyState] = useState(initialReady)
  // Latch: once ready, never flip back to false within a session.
  const setReady = useCallback((next: boolean) => {
    if (!next) return
    setReadyState(true)
  }, [])
  return (
    <SplashReadyContext.Provider value={{ ready, setReady }}>
      {children}
    </SplashReadyContext.Provider>
  )
}

export function useSplashReady() {
  return useContext(SplashReadyContext)
}

/** Call from any component to mark the app as ready once `condition` is true. */
export function useReportSplashReady(condition: boolean) {
  const { setReady } = useSplashReady()
  useEffect(() => {
    if (condition) setReady(true)
  }, [condition, setReady])
}
