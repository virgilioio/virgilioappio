import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { usePermissions } from '@/hooks/usePermissions'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useClientOrganizations } from '@/components/references/templates/useClientOrganizations'
import { TemplateListTable } from '@/components/references/templates/TemplateListTable'
import { TemplateEditor } from '@/components/references/templates/TemplateEditor'
import { QUESTION_TYPES, type ReferenceTemplate } from '@/lib/references/templateModel'

const MUTED = '#8B8F9E'

function QuestionLibraryDialog({ onClose }: { onClose: () => void }) {
  const families: { key: 'standard' | 'reference'; label: string }[] = [
    { key: 'standard', label: 'Standard question types' },
    { key: 'reference', label: 'Reference-specific types' },
  ]
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-6" style={{ background: 'rgba(13,13,9,0.45)' }}>
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

export default function ReferencesPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { canViewReferences } = usePermissions()

  const activeTab = pathname === '/references/templates' ? 'templates' : 'requests'

  const { templates, isLoading, createTemplate, updateTemplate, duplicateTemplate } =
    useReferenceTemplates()
  const { clients } = useClientOrganizations()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const editing = templates.find((t) => t.id === editingId) ?? null

  if (!canViewReferences) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          You don't have access to Reference checks.
        </p>
      </div>
    )
  }

  const handleNew = async () => {
    const created = await createTemplate.mutateAsync(undefined)
    setEditingId(created.id)
  }

  const handleDuplicate = async (source: ReferenceTemplate) => {
    const copy = await duplicateTemplate.mutateAsync(source)
    setEditingId(copy.id)
  }

  return (
    <Section className="min-h-[calc(100dvh-4rem)]">
      <AppContainer>
        <PageHeader title="Reference checks">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setEditingId(null)
              navigate(value === 'templates' ? '/references/templates' : '/references', { replace: true })
            }}
          >
            <TabsList>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
          </Tabs>
        </PageHeader>

        {activeTab === 'requests' ? (
          <Card className="p-6">
            <EmptyState
              variant="page"
              title="No reference checks yet"
              description="Reference check requests will appear here once they are created."
              icon={FileText}
            />
          </Card>
        ) : editing ? (
          <TemplateEditor
            template={editing}
            clients={clients}
            saving={updateTemplate.isPending}
            onBack={() => setEditingId(null)}
            onSave={async (patch) => {
              await updateTemplate.mutateAsync({ id: editing.id, patch })
            }}
            onDuplicate={() => handleDuplicate(editing)}
          />
        ) : (
          <TemplateListTable
            templates={templates}
            clients={clients}
            isLoading={isLoading}
            onOpen={(t) => setEditingId(t.id)}
            onNew={handleNew}
            onQuestionLibrary={() => setLibraryOpen(true)}
          />
        )}

        {libraryOpen && <QuestionLibraryDialog onClose={() => setLibraryOpen(false)} />}
      </AppContainer>
    </Section>
  )
}
