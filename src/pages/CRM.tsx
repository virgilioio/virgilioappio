import { useSearchParams } from 'react-router-dom'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { OrganizationsTab } from '@/components/settings/OrganizationsTab'
import { usePermissions } from '@/hooks/usePermissions'

const CRM_TABS = [
  { id: 'companies', label: 'Companies' },
] as const

type CrmTabId = (typeof CRM_TABS)[number]['id']

export default function CRM() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { canViewOrganizations } = usePermissions()

  const requested = searchParams.get('tab') as CrmTabId | null
  const currentTab: CrmTabId =
    requested && CRM_TABS.some(t => t.id === requested) ? requested : 'companies'

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
  }

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
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              {CRM_TABS.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="companies" className="mt-6">
              <OrganizationsTab />
            </TabsContent>
          </Tabs>
        </Section>
      </AppContainer>
    </div>
  )
}
