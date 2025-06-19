
import { Building, Lock, User, Mail, Phone, Globe, Calendar, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Organization {
  id: string
  name: string
  country: string
  status: 'active' | 'inactive'
  created_at: string
  billing_poc_user_id?: string | null
  billing_poc_additional_email?: string | null
  billing_poc_phone?: string | null
  billing_poc_user_email?: string | null
  billing_poc_user_name?: string | null
}

interface OrganizationDisplayProps {
  organization: Organization
}

export function OrganizationDisplay({ organization }: OrganizationDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Basic Organization Information */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="h-4 w-4" />
            Organization Information
            <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Organization Name</p>
                <p className="text-sm font-medium">{organization.name}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Country
                </p>
                <p className="text-sm font-medium">{organization.country}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <Badge 
                  variant={organization.status === 'active' ? 'success' : 'secondary'}
                  className="text-xs"
                >
                  {organization.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created
                </p>
                <p className="text-sm font-medium">
                  {new Date(organization.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing POC Information */}
      <Card className="border-l-4 border-l-warning">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-4 w-4" />
            Billing Point of Contact
            <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Designated contact for billing and compliance matters
          </p>
        </CardHeader>
        <CardContent>
          {organization.billing_poc_user_name ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Primary Contact
                  </p>
                  <p className="text-sm font-medium">{organization.billing_poc_user_name}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Primary Email
                  </p>
                  <p className="text-sm font-medium">{organization.billing_poc_user_email || 'Not provided'}</p>
                </div>
              </div>
              
              {organization.billing_poc_additional_email && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Additional Email
                    </p>
                    <p className="text-sm font-medium">{organization.billing_poc_additional_email}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone Number
                  </p>
                  <p className="text-sm font-medium">{organization.billing_poc_phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No billing point of contact assigned</p>
              <p className="text-xs text-muted-foreground mt-1">
                A billing POC is required for compliance purposes
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="bg-muted/20">
        <CardContent className="pt-4">
          <div className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Organization ID:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                {organization.id}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
