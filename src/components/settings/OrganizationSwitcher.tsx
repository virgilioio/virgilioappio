import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, RotateCcw } from 'lucide-react'

export function OrganizationSwitcher() {
  const { 
    userType, 
    organizationId, 
    availableOrganizations, 
    switchOrganization 
  } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  // Only show for platform admins
  if (userType !== 'platform_admin' || !availableOrganizations) {
    return null
  }

  const handleOrganizationSwitch = async (newOrgId: string) => {
    if (newOrgId === organizationId) return
    
    setIsLoading(true)
    try {
      await switchOrganization(newOrgId)
      // Force a page reload to refresh all data
      window.location.reload()
    } catch (error) {
      console.error('Error switching organization:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentOrg = availableOrganizations.find(org => org.id === organizationId)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Organization Context
          <Badge variant="secondary" className="text-xs">
            Platform Admin
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Current Organization
          </label>
          <div className="text-sm font-medium">
            {currentOrg?.name || 'None Selected'}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Switch to Organization
          </label>
          <Select
            value={organizationId || ''}
            onValueChange={handleOrganizationSwitch}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select organization..." />
            </SelectTrigger>
            <SelectContent>
              {availableOrganizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {org.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RotateCcw className="h-3 w-3 animate-spin" />
            Switching organization...
          </div>
        )}
      </CardContent>
    </Card>
  )
}