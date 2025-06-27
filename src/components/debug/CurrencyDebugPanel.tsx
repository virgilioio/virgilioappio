
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

export function CurrencyDebugPanel() {
  const { defaultCurrency } = useOrganizationCurrency()
  const { userType, organizationId, user } = useAuth()

  // Only show for platform admins in development
  if (userType !== 'platform_admin') return null

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4" />
          Currency Debug Panel
          <Badge variant="secondary" className="text-xs">Dev Mode</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div><strong>User:</strong> {user?.email}</div>
        <div><strong>User Type:</strong> {userType}</div>
        <div><strong>Organization ID:</strong> {organizationId}</div>
        <div><strong>Default Currency:</strong> <Badge variant="outline">{defaultCurrency}</Badge></div>
        <div className="text-xs text-muted-foreground mt-2">
          Check console logs for detailed currency conversion information
        </div>
      </CardContent>
    </Card>
  )
}
