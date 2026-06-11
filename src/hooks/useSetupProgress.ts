import { useQuery } from '@tanstack/react-query'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { useDepartments } from '@/hooks/useDepartments'
import { useMembers } from '@/hooks/useMembers'
import { useTenant } from '@/hooks/useTenant'
import { supabase } from '@/integrations/supabase/client'

/**
 * Shared setup progress used by the sidebar badge and the SetupTab.
 * React Query dedupes the underlying queries so calling this from
 * multiple components is cheap.
 */
export function useSetupProgress() {
  const { tenant } = useTenant()
  const { identities: mail = [] } = useMailIdentities()
  const { identities: calendars = [] } = useCalendarIdentities()
  const { departments } = useDepartments()
  const { members } = useMembers()

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

  const checks = [
    mail.length > 0,
    calendars.length > 0,
    !!(tenant as any)?.logo_url,
    (departments?.length ?? 0) > 0,
    (members?.length ?? 0) > 1,
    false, // pipeline review — no signal yet
    scorecardCount > 0,
    false, // careers page published — no signal yet
  ]

  const essentialsTotal = checks.length
  const configuredCount = checks.filter(Boolean).length
  const essentialsRemaining = essentialsTotal - configuredCount

  return { essentialsRemaining, essentialsTotal, configuredCount }
}
