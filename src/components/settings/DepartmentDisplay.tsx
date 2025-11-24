import { Building2, Calendar, User, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Organization } from "@/hooks/useOrganizations";

interface DepartmentDisplayProps {
  organization: Organization;
}

export function DepartmentDisplay({ organization }: DepartmentDisplayProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const hasBillingPOC = organization.billing_poc_user_id || 
                        organization.billing_poc_additional_email || 
                        organization.billing_poc_phone;

  return (
    <div className="space-y-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>Organization Name</span>
          </div>
          <p className="font-medium">{organization.name}</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{organization.status}</Badge>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Created</span>
          </div>
          <p className="text-sm">{formatDate(organization.created_at)}</p>
        </div>
      </div>

      {hasBillingPOC && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Billing Point of Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {organization.billing_poc_user_id && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>User ID</span>
                  </div>
                  <p className="text-sm">{organization.billing_poc_user_id}</p>
                </div>
              )}

              {organization.billing_poc_additional_email && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </div>
                  <p className="text-sm">{organization.billing_poc_additional_email}</p>
                </div>
              )}

              {organization.billing_poc_phone && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>Phone</span>
                  </div>
                  <p className="text-sm">{organization.billing_poc_phone}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Separator />
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Organization ID</p>
        <code className="text-xs bg-muted px-2 py-1 rounded">{organization.id}</code>
      </div>
    </div>
  );
}
