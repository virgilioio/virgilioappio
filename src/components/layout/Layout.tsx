import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { BulkUploadProvider } from '@/contexts/BulkUploadContext'
import { GlobalBulkUploadWidget } from '@/components/candidates/GlobalBulkUploadWidget'
import { PhoneShell } from '@/components/phone/PhoneShell'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { HeaderContextBands } from '@/components/layout/HeaderContextBands'
import { usePermissions } from '@/hooks/usePermissions'

// External users (2026-10-24) use the ATS only: these addresses send them to Jobs.
const EXTERNAL_BLOCKED = ['/analytics', '/insights', '/talent-intelligence', '/references', '/candidates', '/find', '/calendar', '/chat', '/billing', '/os', '/sign']
const blockedForExternal = (path: string) => EXTERNAL_BLOCKED.some((p) => path === p || path.startsWith(p + '/'))

export function Layout() {
  const location = useLocation()
  const { isExternal } = usePermissions()


  if (isExternal && blockedForExternal(location.pathname)) return <Navigate to="/jobs" replace />

  const isReview = /^\/jobs\/[^/]+\/review(\/|$|\?)/.test(location.pathname + (location.search || ''))

  return (
    <AuthGate>
      <OrgGate>
        <BulkUploadProvider>
          <AppSidebar />
          {!isReview && (
            <div aria-hidden className="hidden sm:block fixed top-0 left-[5.5rem] right-3 h-3 z-40 bg-virgilio-cream pointer-events-none" />
          )}
          <div className={isReview ? 'bg-virgilio-cream sm:pl-[5.5rem]' : 'bg-virgilio-cream sm:pl-[5.5rem] sm:pr-3'}>
            {!isReview && <Header />}
            {!isReview && <HeaderContextBands />}
            <main
              className={
                isReview
                  ? 'pt-0 pb-0 min-h-[100dvh]'
                  : 'pt-[calc(env(safe-area-inset-top,0px)+72px)] sm:pt-16 pb-28 sm:pb-0 min-h-screen sm:min-h-[calc(100vh-4rem)] sm:[--tbl-page-top:4rem]'
              }
            >
              <Outlet />
            </main>
          </div>
          <GlobalBulkUploadWidget />
          {!isReview && <PhoneShell />}
        </BulkUploadProvider>
      </OrgGate>
    </AuthGate>
  )
}

