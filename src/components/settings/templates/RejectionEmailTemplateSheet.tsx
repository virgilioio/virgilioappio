import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { TemplateEditorSheet } from './TemplateEditorSheet';

interface RejectionEmailTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  /** The template as the list has it: a copy made a moment ago isn't in this sheet's own list yet. */
  template?: { name: string; subject: string; body: string };
  context: 'platform-defaults' | 'organization';
}

/** Settings › Templates: one rejection email in the shared template editor (variables in the editor, 2026-11-07). */
export function RejectionEmailTemplateSheet({ open, onOpenChange, templateId, template, context }: RejectionEmailTemplateSheetProps) {
  const { templates, createTemplate, updateTemplate } = useRejectionEmailTemplates(context);
  const editing = templateId ? template ?? templates.find((t) => t.id === templateId) : undefined;

  return (
    <TemplateEditorSheet
      open={open}
      onOpenChange={onOpenChange}
      initial={editing ? { name: editing.name, subject: editing.subject, body: editing.body } : undefined}
      eyebrow="Settings · Rejection emails"
      noun="rejection email"
      namePlaceholder="e.g. After the interview"
      subjectPlaceholder="e.g. Your application for {{job.title}}"
      purpose="rejection"
      onSave={async (draft) => {
        if (templateId) await updateTemplate(templateId, draft);
        else await createTemplate(draft);
      }}
    />
  );
}
