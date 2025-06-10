
import { AuthGate } from '@/components/auth/AuthGate'
import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16">
          {children}
        </main>
      </div>
    </AuthGate>
  )
}
