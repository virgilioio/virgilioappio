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
import { useOfferTemplates } from '@/hooks/useOfferTemplates';
import { Loader2, Settings } from 'lucide-react';

interface OfferLetterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  context: 'platform-defaults' | 'organization';
  onFieldsClick?: (templateId: string) => void;
}

export function OfferLetterSheet({
  open,
  onOpenChange,
  templateId,
  context,
  onFieldsClick,
}: OfferLetterSheetProps) {
  const { templates, createTemplate, updateTemplate } = useOfferTemplates(context);
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
      console.error('Error saving offer letter template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Offer Letter Template' : 'Create Offer Letter Template'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update your offer letter template details and content'
              : 'Create a new offer letter template with placeholders'}
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
                placeholder="e.g., Senior Developer Offer Letter"
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
              <Label htmlFor="content">Template Content</Label>
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                placeholder="Enter your offer letter template content here. Use placeholders like {{job.title}} or {{candidate.name}}"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.content}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? 'Update' : 'Create'} Template
                </Button>
              </div>
              
              {isEditMode && onFieldsClick && (
                <Button variant="outline" onClick={() => onFieldsClick(templateId)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure Fields
                </Button>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <PlaceholderHelper templateId={isEditMode ? templateId : undefined} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
