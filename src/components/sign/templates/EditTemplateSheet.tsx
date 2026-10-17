import { useTemplates } from '@/lib/sign/templates'
import { TemplateWizard } from './TemplateWizard'

/** The template editor opened from Send for signature (admins), stacked on the sheet. */
export function EditTemplateSheet({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const templates = useTemplates()
  const row = templates.data?.find((t) => t.id === templateId) ?? null
  return <TemplateWizard open={!!row} init={row} mode="edit" onClose={onClose} />
}
