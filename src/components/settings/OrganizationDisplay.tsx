
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
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <Building className="h-5 w-5" />
            Organization Information
            <Lock className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Organization Name</p>
                <p className="text-lg font-semibold">{organization.name}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Country
                </p>
                <p className="text-base font-medium">{organization.country}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge 
                  variant={organization.status === 'active' ? 'success' : 'secondary'}
                  className="text-sm"
                >
                  {organization.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </p>
                <p className="text-base font-medium">
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
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-5 w-5" />
            Billing Point of Contact
            <Lock className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Designated contact for billing and compliance matters
          </p>
        </CardHeader>
        <CardContent>
          {organization.billing_poc_user_name ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Primary Contact
                  </p>
                  <p className="text-base font-medium">{organization.billing_poc_user_name}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Primary Email
                  </p>
                  <p className="text-base font-medium">{organization.billing_poc_user_email || 'Not provided'}</p>
                </div>
              </div>
              
              {organization.billing_poc_additional_email && (
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Additional Email
                    </p>
                    <p className="text-base font-medium">{organization.billing_poc_additional_email}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </p>
                  <p className="text-base font-medium">{organization.billing_poc_phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No billing point of contact assigned</p>
              <p className="text-sm text-muted-foreground mt-1">
                A billing POC is required for compliance purposes
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="bg-muted/20">
        <CardContent className="pt-6">
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Organization ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {organization.id}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
