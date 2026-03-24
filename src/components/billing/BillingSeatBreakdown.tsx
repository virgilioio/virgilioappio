import { useMembers } from '@/hooks/useMembers'
import { useRecruiterUserIds } from '@/hooks/useRecruiterUserIds'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function BillingSeatBreakdown() {
  const { members } = useMembers()
  const { recruiterUserIds } = useRecruiterUserIds()
  const { organizationId } = useAuth()
  const { organizations } = useOrganizations()

  const currentOrg = organizations.find((o) => o.id === organizationId)
  const parentOrgId = currentOrg?.parent_organization_id || organizationId

  const { paidCount, freeCount, total } = useMemo(() => {
    const orgMembers = members.filter(
      (m) => (!parentOrgId || m.organization_id === parentOrgId) && m.user_status === 'active'
    )

    const isBillable = (m: any) =>
      m.system_role === 'admin' ||
      m.user_type === 'workspace_owner' ||
      (m.user_id && recruiterUserIds.has(m.user_id))

    const paid = orgMembers.filter(isBillable).length
    const free = orgMembers.length - paid

    return { paidCount: paid, freeCount: free, total: orgMembers.length }
  }, [members, recruiterUserIds, parentOrgId])

  const paidPercent = total > 0 ? (paidCount / total) * 100 : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Team seats</span>
        <span className="font-medium">{total} active</span>
      </div>

      {/* Segmented progress bar */}
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        {total > 0 && (
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
              style={{ width: `${paidPercent}%` }}
            />
            <div
              className="absolute inset-y-0 rounded-full bg-virgilio-success transition-all"
              style={{ left: `${paidPercent}%`, width: `${100 - paidPercent}%` }}
            />
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">
            {paidCount} Paid <span className="hidden sm:inline">· Admins & Recruiters</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-virgilio-success" />
          <span className="text-muted-foreground">
            {freeCount} Free <span className="hidden sm:inline">· HMs & Interviewers</span>
          </span>
        </div>
      </div>

      {/* View team link */}
      <Link
        to="/settings?tab=members"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        View team <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
