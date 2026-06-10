
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth()

  // Cold-load splash covers this; in-session re-checks render nothing briefly.
  if (isLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}
