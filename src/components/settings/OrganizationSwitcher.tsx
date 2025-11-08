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
import { Separator } from '@/components/ui/separator'
import { Building2, RotateCcw, Users, Eye } from 'lucide-react'

const VIRGILIO_ORG_ID = '5ba7b145-f251-4b18-8900-724cb06028ab';

export function OrganizationSwitcher() {
  const { 
    userType, 
    organizationId, 
    availableOrganizations, 
    isImpersonating,
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
  const platformOrgs = availableOrganizations.filter(org => org.organization_type === 'platform')
  const internalWorkspaces = availableOrganizations.filter(org => org.organization_type === 'client' && org.tenant_type === 'internal')
  const saasCustomers = availableOrganizations.filter(org => org.organization_type === 'client' && org.tenant_type === 'saas')
  
  const isPlatformContext = organizationId === VIRGILIO_ORG_ID

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {isPlatformContext ? 'Platform Admin Context' : 'Workspace Context'}
          <Badge variant="secondary" className="text-xs">
            {isPlatformContext ? 'Platform' : 'Workspace'}
          </Badge>
          {isImpersonating && (
            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
              <Eye className="h-3 w-3 mr-1" />
              Customer View
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Current Context
          </label>
          <div className="text-sm font-medium flex items-center gap-2">
            {currentOrg?.organization_type === 'platform' ? (
              <Building2 className="h-3 w-3 text-blue-600" />
            ) : currentOrg?.tenant_type === 'internal' ? (
              <Users className="h-3 w-3 text-green-600" />
            ) : (
              <Eye className="h-3 w-3 text-orange-600" />
            )}
            {currentOrg?.name || 'None Selected'}
            {isImpersonating && (
              <span className="text-xs text-orange-600">(Customer View)</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Switch Context
          </label>
          <Select
            value={organizationId || ''}
            onValueChange={handleOrganizationSwitch}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select context..." />
            </SelectTrigger>
            <SelectContent>
              {/* Platform Organizations */}
              {platformOrgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-blue-600" />
                    <span className="font-medium">{org.name}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">Platform</Badge>
                  </div>
                </SelectItem>
              ))}
              
              {platformOrgs.length > 0 && internalWorkspaces.length > 0 && (
                <Separator className="my-1" />
              )}
              
              {/* Internal Workspaces */}
              {internalWorkspaces.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-green-600" />
                    <span className="font-medium">{org.name}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">Workspace</Badge>
                  </div>
                </SelectItem>
              ))}
              
              {(platformOrgs.length > 0 || internalWorkspaces.length > 0) && saasCustomers.length > 0 && (
                <Separator className="my-1" />
              )}
              
              {/* SaaS Customers */}
              {saasCustomers.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-orange-600" />
                    <span>{org.name}</span>
                    <Badge variant="outline" className="text-xs ml-auto border-orange-200 text-orange-700">Customer</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RotateCcw className="h-3 w-3 animate-spin" />
            Switching context...
          </div>
        )}
        
        {!isPlatformContext && (
          <div className={isImpersonating ? "bg-orange-50 border border-orange-200 rounded-md p-3" : "bg-green-50 border border-green-200 rounded-md p-3"}>
            <div className={`flex items-center gap-2 text-xs ${isImpersonating ? 'text-orange-700' : 'text-green-700'}`}>
              {isImpersonating ? <Eye className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              <span className="font-medium">{isImpersonating ? 'Customer View Mode' : 'Workspace Mode'}</span>
            </div>
            <p className={`text-xs mt-1 ${isImpersonating ? 'text-orange-600' : 'text-green-600'}`}>
              {isImpersonating 
                ? "You are viewing this customer's workspace. All data shown is from their organization."
                : "You are in workspace mode. You can use the ATS features and manage jobs, candidates, etc."
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}