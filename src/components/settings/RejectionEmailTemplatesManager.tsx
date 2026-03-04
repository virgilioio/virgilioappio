import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, FileX } from 'lucide-react';
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates';
import { RejectionEmailTemplateSheet } from './templates/RejectionEmailTemplateSheet';

interface RejectionEmailTemplatesManagerProps {
  context: 'platform-defaults' | 'organization';
}

export function RejectionEmailTemplatesManager({ context }: RejectionEmailTemplatesManagerProps) {
  const { templates, isLoading, deleteTemplate } = useRejectionEmailTemplates(context);
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
          <div className="text-center py-8">
            <FileX className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No rejection email templates found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first rejection email template to get started
            </p>
          </div>
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
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                    <TableCell>
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    {context === 'organization' && (
                      <TableCell>
                        <Badge variant={template.source === 'platform' ? 'secondary' : 'default'}>
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={context === 'organization' && template.source === 'platform'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{template.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTemplate(template.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
