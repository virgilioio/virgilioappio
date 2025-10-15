import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { PlaceholderHelper } from '../PlaceholderHelper';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { Loader2 } from 'lucide-react';

interface ContractTemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  context: 'platform-defaults' | 'organization';
}

export function ContractTemplateSheet({
  open,
  onOpenChange,
  templateId,
  context,
}: ContractTemplateSheetProps) {
  const { templates, createTemplate, updateTemplate } = useContractTemplates(context);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = !!templateId;
  const editingTemplate = templates.find(t => t.id === templateId);

  useEffect(() => {
    if (isEditMode && editingTemplate) {
      setFormData({
        name: editingTemplate.name,
        description: editingTemplate.description || '',
        content: editingTemplate.content,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        content: '',
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
      console.error('Error saving contract template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Contract Template' : 'Create Contract Template'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update your contract template details and content'
              : 'Create a new contract template with placeholders'}
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
                placeholder="e.g., Employment Contract - Full Time"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of when to use this template"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contract Content</Label>
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                placeholder="Enter your contract template content here. Use placeholders like {{job.title}} or {{candidate.name}}"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.content}>
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
