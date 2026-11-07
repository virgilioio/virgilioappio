import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { TemplateEditorSheet } from './TemplateEditorSheet';

interface EmailTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  context: 'platform-defaults' | 'organization';
}

/** Settings › Templates: one email template in the shared template editor (variables in the editor, 2026-11-07). */
export function EmailTemplateSheet({ open, onOpenChange, templateId, context }: EmailTemplateSheetProps) {
  const { templates, createTemplate, updateTemplate } = useEmailTemplates(context);
  const editing = templateId ? templates.find((t) => t.id === templateId) : undefined;

  return (
    <TemplateEditorSheet
      open={open}
      onOpenChange={onOpenChange}
      initial={editing ? { name: editing.name, subject: editing.subject, body: editing.body } : undefined}
      eyebrow="Settings · Email templates"
      noun="email template"
      namePlaceholder="e.g. Interview invitation"
      subjectPlaceholder="e.g. Interview for {{job.title}}"
      purpose="template"
      onSave={async (draft) => {
        if (templateId) await updateTemplate(templateId, draft);
        else await createTemplate(draft);
      }}
    />
  );
}
