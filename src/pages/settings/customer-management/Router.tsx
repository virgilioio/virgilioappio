import { Routes, Route, Navigate } from 'react-router-dom'
import { PlatformAdminAndFlagGuard } from '@/components/auth/PlatformAdminAndFlagGuard'
import { FeatureDisabled } from '@/components/settings/FeatureDisabled'
import { CustomerManagementTab } from './CustomerManagementTab'
import { SaaSCustomerDetails } from './SaaSCustomerDetails'

export function CustomerManagementRouter() {
  return (
    <PlatformAdminAndFlagGuard
      flagName="self_serve_admin_enabled"
      fallback={
        <FeatureDisabled 
          title="Customer Management Unavailable"
          description="This feature requires platform admin access and must be enabled by system administrators."
        />
      }
    >
      <Routes>
        <Route path="/" element={<CustomerManagementTab />} />
        <Route path="/customers" element={<CustomerManagementTab />} />
        <Route path="/customers/:id" element={<SaaSCustomerDetails />} />
        <Route path="*" element={<Navigate to="/settings?tab=platform-customers" replace />} />
      </Routes>
    </PlatformAdminAndFlagGuard>
  )
}