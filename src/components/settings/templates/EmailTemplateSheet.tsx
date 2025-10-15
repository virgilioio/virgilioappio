import { useState, useEffect } from 'react';
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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { PlaceholderHelper } from '../PlaceholderHelper';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { Loader2 } from 'lucide-react';

interface EmailTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  context: 'platform-defaults' | 'organization';
}

export function EmailTemplateSheet({
  open,
  onOpenChange,
  templateId,
  context,
}: EmailTemplateSheetProps) {
  const { templates, createTemplate, updateTemplate } = useEmailTemplates(context);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = !!templateId;
  const editingTemplate = templates.find(t => t.id === templateId);

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
      console.error('Error saving email template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Email Template' : 'Create Email Template'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update your email template details and content'
              : 'Create a new email template with placeholders'}
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
                placeholder="e.g., Interview Invitation Email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Interview Invitation for {{job.title}}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <RichTextEditor
                value={formData.body}
                onChange={(value) => setFormData({ ...formData, body: value })}
                placeholder="Enter your email template content here. Use placeholders like {{job.title}} or {{candidate.name}}"
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
            <PlaceholderHelper />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
