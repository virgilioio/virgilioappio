import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Mail, Trash2, Calendar, Repeat } from 'lucide-react';
import { useStageAutomations } from '@/hooks/useStageAutomations';
import { AutomationFormDialog } from './AutomationFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface AutomationsTabProps {
  jhsId: string;
  jobId: string;
  organizationId: string;
}

export function AutomationsTab({ jhsId, jobId, organizationId }: AutomationsTabProps) {
  const { automations, isLoading, toggleActive, deleteAutomation } = useStageAutomations(jhsId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  if (isLoading) {
    return <div className="p-4">Loading automations...</div>;
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Email Automations</h3>
          <p className="text-sm text-muted-foreground">
            Automatically send emails when candidates enter or exit this stage
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Automation
        </Button>
      </div>
      
      {automations.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium mb-2">No automations yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first automation to start engaging candidates automatically
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Automation
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map(automation => {
            const hasRecurring = automation.emails.some(e => e.is_recurring);
            const recurringEmail = automation.emails.find(e => e.is_recurring);
            
            return (
              <Card key={automation.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={automation.automation_type === 'single_email' ? 'secondary' : 'default'}>
                        {automation.automation_type === 'single_email' ? 'Single Email' : 'Email Sequence'}
                      </Badge>
                      <Badge variant="outline">
                        {automation.trigger_event === 'on_stage_enter' ? 'On Stage Enter' : 'On Stage Exit'}
                      </Badge>
                      {hasRecurring && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          Recurring
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {automation.emails.length} {automation.emails.length === 1 ? 'email' : 'emails'}
                      {hasRecurring && recurringEmail && (
                        <span className="ml-2">
                          • Repeats every {recurringEmail.recurrence_interval_value} {recurringEmail.recurrence_interval_unit}
                          {recurringEmail.max_occurrences && ` (max ${recurringEmail.max_occurrences} times)`}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-3 space-y-1">
                      {automation.emails.map((email, index) => (
                        <div key={email.id} className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>
                            Email {index + 1}: {email.subject}
                            {email.delay_value && ` (${email.delay_value} ${email.delay_unit})`}
                            {email.is_recurring && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                <Repeat className="h-3 w-3 mr-1" />
                                Every {email.recurrence_interval_value} {email.recurrence_interval_unit}
                              </Badge>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={(checked) => 
                          toggleActive.mutate({ id: automation.id, isActive: checked })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(automation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      
      <AutomationFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        jhsId={jhsId}
        jobId={jobId}
        organizationId={organizationId}
      />
      
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this automation and cancel any pending emails.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteAutomation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
