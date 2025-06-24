
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { AppSidebar } from './AppSidebar'
import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export function Layout() {
  return (
    <AuthGate>
      <OrgGate>
        <SidebarProvider>
          <div className="min-h-screen bg-background flex w-full">
            <AppSidebar />
            <SidebarInset className="flex-1">
              <Header />
              <main className="pt-12 sm:pt-14">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </OrgGate>
    </AuthGate>
  )
}
