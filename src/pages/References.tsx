import { useNavigate, useLocation } from 'react-router-dom'
import { FileText } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { usePermissions } from '@/hooks/usePermissions'

export default function ReferencesPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { canViewReferences } = usePermissions()

  const activeTab = pathname === '/references/templates' ? 'templates' : 'requests'

  if (!canViewReferences) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          You don't have access to Reference checks.
        </p>
      </div>
    )
  }

  return (
    <Section className="min-h-[calc(100dvh-4rem)]">
      <AppContainer>
        <PageHeader title="Reference checks">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              navigate(value === 'templates' ? '/references/templates' : '/references', { replace: true })
            }
          >
            <TabsList>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
          </Tabs>
        </PageHeader>

        <Card className="p-6">
          {activeTab === 'requests' ? (
            <EmptyState
              variant="page"
              title="No reference checks yet"
              description="Reference check requests will appear here once they are created."
              icon={FileText}
            />
          ) : (
            <EmptyState
              variant="page"
              title="No templates yet"
              description="Reference check templates will appear here once they are created."
              icon={FileText}
            />
          )}
        </Card>
      </AppContainer>
    </Section>
  )
}
