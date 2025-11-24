
import { Building, User, Mail, Phone, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface Organization {
  id: string
  name: string
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
  // Format date
  const formattedDate = new Date(organization.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Billing POC data (removed member lookup for simplicity)
  const billingPOCName = organization.billing_poc_user_name || 'Not assigned'
  const billingPOCEmail = organization.billing_poc_user_email || organization.billing_poc_additional_email || 'Not provided'

  return (
    <div className="space-y-md">
      {/* Basic Info Section */}
      <div className="space-y-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium">Organization Name</label>
            <p className="text-sm font-medium mt-1">{organization.name}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <div className="mt-1">
              <Badge variant={organization.status === 'active' ? 'success' : 'secondary'}>
                {organization.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
        <Separator />
        <div>
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Created
          </label>
          <p className="text-sm font-medium mt-1">{formattedDate}</p>
        </div>
      </div>

      {/* Billing POC - if assigned */}
      {organization.billing_poc_user_id && (
        <>
          <Separator />
          <div className="space-y-sm">
            <h4 className="text-sm font-medium">Billing Point of Contact</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Name
                </label>
                <p className="mt-1">{billingPOCName}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  Email
                </label>
                <p className="mt-1">{billingPOCEmail}</p>
              </div>
            </div>
            {organization.billing_poc_phone && (
              <div>
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Phone Number
                </label>
                <p className="text-sm mt-1">{organization.billing_poc_phone}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* System Information */}
      <Separator />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Organization ID:</span>
        <code className="bg-muted px-2 py-1 rounded font-mono text-muted-foreground">
          {organization.id}
        </code>
      </div>
    </div>
  )
}
