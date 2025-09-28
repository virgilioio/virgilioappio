import { Routes, Route, Navigate } from 'react-router-dom'
import { PlatformAdminAndFlagGuard } from '@/components/auth/PlatformAdminAndFlagGuard'
import { FeatureDisabled } from '@/components/settings/FeatureDisabled'
import { SaaSCustomersList } from './SaaSCustomersList'
import { SaaSCustomerDetail } from './SaaSCustomerDetail'

export function SaaSCustomersRouter() {
  return (
    <PlatformAdminAndFlagGuard
      flagName="saas_customers_enabled"
      fallback={
        <FeatureDisabled 
          title="SaaS Customer Management Unavailable"
          description="This feature requires platform admin access and must be enabled by system administrators."
        />
      }
    >
      <Routes>
        <Route path="/" element={<SaaSCustomersList />} />
        <Route path="/:id" element={<SaaSCustomerDetail />} />
        <Route path="*" element={<Navigate to="/settings?tab=platform" replace />} />
      </Routes>
    </PlatformAdminAndFlagGuard>
  )
}