
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { AppSidebar } from './AppSidebar'
import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'

export function Layout() {
  return (
    <AuthGate>
      <OrgGate>
        <SidebarProvider>
          <div className="min-h-screen bg-background flex w-full">
            <AppSidebar />
            <SidebarInset className="flex-1">
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <div className="flex-1">
                  <Header />
                </div>
              </header>
              <main className="flex-1 p-4">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </OrgGate>
    </AuthGate>
  )
}
