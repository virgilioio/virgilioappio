
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <AuthGate>
      <OrgGate>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="pt-16">
            {children}
          </main>
        </div>
      </OrgGate>
    </AuthGate>
  )
}
