import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
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
    <div className="h-[100dvh] flex flex-col">
      <AppContainer>
        <Section>
          <OrganizationsTab />
        </Section>
      </AppContainer>
    </div>
  )
}
