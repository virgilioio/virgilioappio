import { useNavigate, useParams } from 'react-router-dom'

import { usePermissions } from '@/hooks/usePermissions'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useClientOrganizations } from '@/components/references/templates/useClientOrganizations'
import { TemplateEditor } from '@/components/references/templates/TemplateEditor'
import { ReferencesShell, ReferencesNoAccess } from '@/components/references/ReferencesShell'
import type { ReferenceTemplate } from '@/lib/references/templateModel'

/** /references/templates/:id — the template editor. */
export default function ReferenceTemplateEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { canViewReferences } = usePermissions()
  const { templates, isLoading, updateTemplate, duplicateTemplate } = useReferenceTemplates()
  const { clients } = useClientOrganizations()

  if (!canViewReferences) return <ReferencesNoAccess />

  const template = templates.find((t) => t.id === id) ?? null

  if (!template) {
    return (
      <ReferencesShell>
        <p className="font-inter text-[12.5px] text-[#5A6072]">
          {isLoading ? 'Loading template…' : 'Template not found.'}
        </p>
      </ReferencesShell>
    )
  }

  const handleDuplicate = async (source: ReferenceTemplate) => {
    const copy = await duplicateTemplate.mutateAsync(source)
    navigate(`/references/templates/${copy.id}`)
  }

  return (
    <ReferencesShell>
      <TemplateEditor
        template={template}
        clients={clients}
        saving={updateTemplate.isPending}
        onBack={() => navigate('/references/templates')}
        onSave={async (patch) => {
          await updateTemplate.mutateAsync({ id: template.id, patch })
        }}
        onDuplicate={() => handleDuplicate(template)}
      />
    </ReferencesShell>
  )
}
