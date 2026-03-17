
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { GioLoader } from '@/components/ui/GioLoader'

interface AuthGateProps {
  children: React.ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <GioLoader message="Loading..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}
