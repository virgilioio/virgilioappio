import { useAuth } from '@/contexts/AuthContext'

export function OrganizationSwitcher() {
  const { userType } = useAuth()

  // Platform admins don't need organization switching
  // They stay in Virgilio context and view SaaS customer data through dashboards
  if (userType === 'platform_admin') {
    return null
  }

  // For now, return null - workspace owners might use this in the future
  return null
}