import PersonDetailPage from './PersonDetail'
import { ExternalProfile } from '@/components/os/ExternalProfile'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * /me, My profile (Part B, 2026-10-23; one view with its side menu since 2026-10-24): every member's own page.
 * External users (2026-10-24) get the basic page: their jobs and the You card.
 */
export default function MyProfilePage() {
  const { isExternal } = usePermissions()
  return isExternal ? <ExternalProfile /> : <PersonDetailPage self />
}
