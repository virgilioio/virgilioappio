
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <AuthGate>
      <OrgGate>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="pt-12 sm:pt-14">
            <Outlet />
          </main>
        </div>
      </OrgGate>
    </AuthGate>
  )
}
