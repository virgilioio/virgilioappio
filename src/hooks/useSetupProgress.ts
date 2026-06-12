import { useQuery } from '@tanstack/react-query'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { useDepartments } from '@/hooks/useDepartments'
import { useMembers } from '@/hooks/useMembers'
import { useTenant } from '@/hooks/useTenant'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCareersPageSettings } from '@/hooks/useCareersPageSettings'
import { useBookingConfig } from '@/hooks/useBookingConfig'
import { useBookingEventTypes } from '@/hooks/useBookingEventTypes'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

export interface SetupChecks {
  // "You" tier
  profile: boolean
  mail: boolean
  calendar: boolean
  booking: boolean
  // "Workspace" tier
  brand: boolean
  departments: boolean
  team: boolean
  teamPending: boolean // any invited but not accepted
  templates: boolean
  // counts/context
  invitesSent: number
  invitesAccepted: number
  firstDepartment: string | null
}

/**
 * Shared setup state. Returns the live derivations + per-tier visibility
 * so the SetupTab and the nav badge agree.
 */
export function useSetupProgress() {
  const { tenant } = useTenant()
  const { profile } = useUserProfile()
  const { identities: mail = [] } = useMailIdentities()
  const { identities: calendars = [] } = useCalendarIdentities()
  const { departments = [] } = useDepartments()
  const { members = [] } = useMembers()
  const { settings: careers } = useCareersPageSettings()
  const { config: bookingConfig } = useBookingConfig()
  const { eventTypes = [] } = useBookingEventTypes()
  const { userType, organizationId } = useAuth()
  const permissions = usePermissions()

  const isOwner = userType === 'workspace_owner' && !!organizationId
  const isAdminOrOwner = permissions.isPlatformAdmin || permissions.isAdmin || isOwner

  const { data: scorecardCount = 0 } = useQuery({
    queryKey: ['setup', 'scorecard-templates-count', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('stage_scorecard_templates')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)
      return (count as number) ?? 0
    },
  })

  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
  const profileDone = !!fullName && !!profile?.title && !!profile?.avatar_url

  const activeEventTypes = (eventTypes ?? []).filter((e: any) => e?.is_active).length
  const bookingDone =
    !!bookingConfig && (bookingConfig as any)?.is_active !== false && activeEventTypes >= 1

  const brandDone = !!(careers as any)?.logo_url && !!((tenant as any)?.about?.trim())
  const departmentsDone = (departments?.length ?? 0) >= 1

  const accepted = members.filter((m: any) => m.user_status === 'active').length
  const invited = members.filter((m: any) => m.user_status === 'invited').length
  const teamDone = accepted > 1 // at least one accepted besides owner
  const teamPending = invited > 0 && !teamDone

  const templatesDone = scorecardCount > 0

  const checks: SetupChecks = {
    profile: profileDone,
    mail: mail.length > 0,
    calendar: calendars.length > 0,
    booking: bookingDone,
    brand: brandDone,
    departments: departmentsDone,
    team: teamDone,
    teamPending,
    templates: templatesDone,
    invitesSent: invited,
    invitesAccepted: accepted,
    firstDepartment: departments?.[0]?.name ?? null,
  }

  // Essentials visible to current user. Members only see the "You" tier.
  const youEssentials = [checks.profile, checks.mail, checks.calendar, checks.booking]
  const workspaceEssentials = [
    checks.brand,
    checks.departments,
    checks.team,
    checks.templates,
  ]

  const visibleEssentials = isAdminOrOwner
    ? [...youEssentials, ...workspaceEssentials]
    : youEssentials

  const essentialsTotal = visibleEssentials.length
  const configuredCount = visibleEssentials.filter(Boolean).length
  const essentialsRemaining = essentialsTotal - configuredCount

  return {
    checks,
    isAdminOrOwner,
    essentialsRemaining,
    essentialsTotal,
    configuredCount,
  }
}
