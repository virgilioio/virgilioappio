import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useClientOrganizations } from '@/components/references/templates/useClientOrganizations'
import { TemplateListTable } from '@/components/references/templates/TemplateListTable'
import { ReferencesShell, ReferencesNoAccess } from '@/components/references/ReferencesShell'
import { QUESTION_TYPES } from '@/lib/references/templateModel'

const MUTED = '#8B8F9E'

function QuestionLibraryDialog({ onClose }: { onClose: () => void }) {
  const families: { key: 'standard' | 'reference'; label: string }[] = [
    { key: 'standard', label: 'Standard question types' },
    { key: 'reference', label: 'Reference-specific types' },
  ]
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-6"
      style={{ background: 'rgba(13,13,9,0.45)' }}
    >
      <Card className="w-full max-w-[520px] max-h-[80vh] overflow-auto p-5 space-y-4 bg-[#fffcf9]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              className="font-poppins font-semibold text-[#0d0d09]"
              style={{ fontSize: 18, letterSpacing: '-0.04em' }}
            >
              Question library
            </h3>
            <p className="font-inter text-[12.5px] text-[#5A6072]">
              The answer types available inside a reference template.
            </p>
          </div>
          <Button variant="ghost" size="xs" icon={X} iconOnly aria-label="Close" onClick={onClose} />
        </div>

        {families.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <p
              className="font-inter font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.06em', color: MUTED }}
            >
              {f.label}
            </p>
            {QUESTION_TYPES.filter((q) => q.family === f.key).map((q) => (
              <div
                key={q.type}
                className="rounded-lg bg-white px-2.5 py-2"
                style={{ border: '1px solid #E7E8EE' }}
              >
                <p className="font-poppins font-medium text-[#0d0d09]" style={{ fontSize: 12.5 }}>
                  {q.label}
                </p>
                {q.hint && (
                  <p className="font-inter" style={{ fontSize: 11.5, color: MUTED }}>
                    {q.hint}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </Card>
    </div>
  )
}

/** /references/templates — the template list. */
export default function ReferenceTemplatesPage() {
  const navigate = useNavigate()
  const { canViewReferences } = usePermissions()
  const { templates, isLoading, createTemplate } = useReferenceTemplates()
  const { clients } = useClientOrganizations()
  const [libraryOpen, setLibraryOpen] = useState(false)

  if (!canViewReferences) return <ReferencesNoAccess />

  const handleNew = async () => {
    const created = await createTemplate.mutateAsync(undefined)
    navigate(`/references/templates/${created.id}`)
  }

  return (
    <ReferencesShell>
      <PageHeader
        title="Templates"
        kicker
        count={templates.length}
        meta={
          <>
            <span>Owned by this tenant — never shared</span>
            <span>Also reachable from Settings → Recruiting</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={BookOpen}
              onClick={() => setLibraryOpen(true)}
            >
              Question library
            </Button>
            <Button variant="primary" size="md" icon={Plus} onClick={handleNew}>
              New template
            </Button>
          </>
        }
      />

      <TemplateListTable
        templates={templates}
        clients={clients}
        isLoading={isLoading}
        onOpen={(t) => navigate(`/references/templates/${t.id}`)}
        onNew={handleNew}
      />

      {libraryOpen && <QuestionLibraryDialog onClose={() => setLibraryOpen(false)} />}
    </ReferencesShell>
  )
}
