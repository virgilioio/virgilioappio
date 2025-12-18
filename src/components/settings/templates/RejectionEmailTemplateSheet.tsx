import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  SubjectTemplateEditor, 
  BodyTemplateEditor,
  type SubjectTemplateEditorHandle,
  type BodyTemplateEditorHandle 
} from '@/components/editors';
import { PlaceholderHelper } from '../PlaceholderHelper';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { Loader2 } from 'lucide-react';

interface RejectionEmailTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  context: 'platform-defaults' | 'organization';
}

export function RejectionEmailTemplateSheet({
  open,
  onOpenChange,
  templateId,
  context,
}: RejectionEmailTemplateSheetProps) {
  const { templates, createTemplate, updateTemplate } = useRejectionEmailTemplates(context);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const subjectRef = useRef<SubjectTemplateEditorHandle>(null);
  const bodyRef = useRef<BodyTemplateEditorHandle>(null);

  const isEditMode = !!templateId;
  const editingTemplate = templates.find(t => t.id === templateId);

  const handleInsertPlaceholder = (placeholder: string) => {
    if (bodyRef.current) {
      bodyRef.current.insertPlaceholder(placeholder);
    }
  };

  useEffect(() => {
    if (isEditMode && editingTemplate) {
      setFormData({
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
      });
    } else {
      setFormData({
        name: '',
        subject: '',
        body: '',
      });
    }
  }, [isEditMode, editingTemplate, open]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (isEditMode && templateId) {
        await updateTemplate(templateId, formData);
      } else {
        await createTemplate(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving rejection email template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Rejection Email Template' : 'Create Rejection Email Template'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update your rejection email template details and content'
              : 'Create a new rejection email template with placeholders'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Post-Interview Rejection"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <SubjectTemplateEditor
                ref={subjectRef}
                id="subject"
                value={formData.subject}
                onChange={(value) => setFormData({ ...formData, subject: value })}
                placeholder="e.g., Update on your application for {{job.title}}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <BodyTemplateEditor
                ref={bodyRef}
                value={formData.body}
                onChange={(value) => setFormData({ ...formData, body: value })}
                placeholder="Enter your rejection email content here. Use placeholders like {{candidate.first_name}} or {{job.title}}"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.subject || !formData.body}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <PlaceholderHelper onInsert={handleInsertPlaceholder} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
