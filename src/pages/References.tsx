import { Plus, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftPaper } from '@/components/ui/EmptyIllustrations'
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

      <EmptyState
        illustration={<SoftPaper />}
        title="No reference checks yet"
        body="Request references from a candidate's profile — checks live with the candidate and follow them across jobs."
        secondary={
          <EmptyAction variant="secondary" onClick={() => navigate('/references/templates')}>
            Manage templates
          </EmptyAction>
        }
      />

    </ReferencesShell>
  )
}
