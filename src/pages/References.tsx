import { FileText, Plus, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { usePermissions } from '@/hooks/usePermissions'
import { ReferencesShell, ReferencesNoAccess } from '@/components/references/ReferencesShell'

/** /references — the request list. */
export default function ReferencesPage() {
  const navigate = useNavigate()
  const { canViewReferences } = usePermissions()

  if (!canViewReferences) return <ReferencesNoAccess />

  return (
    <ReferencesShell>
      <PageHeader
        title="Reference checks"
        kicker
        count={0}
        meta={
          <>
            <span>Across 0 jobs</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={Settings2}
              onClick={() => navigate('/references/templates')}
            >
              Templates
            </Button>
            <Button variant="primary" size="md" icon={Plus} disabled>
              New request
            </Button>
          </>
        }
      />

      <Card className="p-6">
        <EmptyState
          variant="page"
          title="No reference checks yet"
          description="Reference check requests will appear here once they are created."
          icon={FileText}
        />
      </Card>
    </ReferencesShell>
  )
}
