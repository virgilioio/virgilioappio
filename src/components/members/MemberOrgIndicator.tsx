
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface MemberOrgIndicatorProps {
  organizationName: string
  currentUserOrgId?: string | null
}

export function MemberOrgIndicator({ organizationName, currentUserOrgId }: MemberOrgIndicatorProps) {
  const { user, organizationId } = useAuth()
  const isPlatformAdmin = user?.user_metadata?.user_type === 'platform_admin'
  
  // Don't show indicator for platform admins in their own org context
  if (!isPlatformAdmin) {
    return null
  }

  return (
    <div className="flex items-center gap-1">
      <Building2 className="h-3 w-3 text-muted-foreground" />
      <Badge variant="secondary" className="text-xs">
        {organizationName}
      </Badge>
    </div>
  )
}
