import { useState } from 'react';
import { InlineEmpty } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IconTip } from '@/components/ui/tooltip'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { TableSkeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, FileX } from 'lucide-react';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { RejectionEmailTemplateSheet } from './templates/RejectionEmailTemplateSheet';

interface RejectionEmailTemplatesManagerProps {
  context: 'platform-defaults' | 'organization';
}

export function RejectionEmailTemplatesManager({ context }: RejectionEmailTemplatesManagerProps) {
  const { templates, isLoading, deleteTemplate, restoreTemplate } = useRejectionEmailTemplates(context);

  // S18 (Block B §16): a soft delete, so it says what stays and offers Undo.
  const handleDelete = async (template: { id: string; name: string }) => {
    const ok = await confirmDestructive({
      title: `Delete ${template.name}?`,
      description: 'It\u2019s no longer offered when you reject someone. Rejection emails already sent with it stay.',
      confirmLabel: 'Delete template',
    });
    if (!ok) return;
    const exit = collapseRows(rowsById([template.id]));
    await exit.done;
    try {
      await deleteTemplate(template.id);
    } catch {
      exit.revert();
      return;
    }
    undoToast(`${template.name} deleted`, async () => {
      await restoreTemplate(template.id);
      requestAnimationFrame(() => restoreRows(rowsById([template.id])));
    });
  };
  const [sheetState, setSheetState] = useState({ open: false, templateId: undefined as string | undefined });

  const openCreateSheet = () => {
    setSheetState({ open: true, templateId: undefined });
  };

  const openEditSheet = (templateId: string) => {
    setSheetState({ open: true, templateId });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>
            {context === 'platform-defaults' ? 'Platform Default Rejection Templates' : 'Rejection Email Templates'}
          </CardTitle>
          <CardDescription>
            {context === 'platform-defaults'
              ? 'Manage platform-wide default rejection email templates'
              : 'Manage rejection email templates for your organization'
            }
          </CardDescription>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rejection Email
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : templates.length === 0 ? (
          <InlineEmpty
            text="No rejection email templates yet. Create your first template to get started."
            action="Create template"
            onAction={openCreateSheet}
          />
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created</TableHead>
                  {context === 'organization' && <TableHead>Source</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} data-row-id={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                    <TableCell>
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    {context === 'organization' && (
                      <TableCell>
                        <Badge variant={template.source === 'platform' ? 'source-inherited' : 'source-custom'}>
                          {template.source === 'platform' ? 'Inherited' : 'Custom'}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSheet(template.id)}
                          disabled={context === 'organization' && template.source === 'platform'}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <IconTip label={`Delete ${template.name}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${template.name}`}
                            onClick={() => void handleDelete(template)}
                            disabled={context === 'organization' && template.source === 'platform'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </IconTip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <RejectionEmailTemplateSheet
        open={sheetState.open}
        onOpenChange={(open) => setSheetState({ ...sheetState, open })}
        templateId={sheetState.templateId}
        context={context}
      />
    </Card>
  );
}
