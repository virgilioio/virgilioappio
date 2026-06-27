import { OrganizationsTab } from '@/components/settings/OrganizationsTab'
import { usePermissions } from '@/hooks/usePermissions'

export default function CRM() {
  const { canViewOrganizations } = usePermissions()

  if (!canViewOrganizations) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          You don't have access to the CRM.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-virgilio-cream">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
          <OrganizationsTab />
        </div>
      </div>
    </div>
  )
}
