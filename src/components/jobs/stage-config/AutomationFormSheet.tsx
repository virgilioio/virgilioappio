import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStageAutomations, type AutomationEmail, type StageAutomation } from '@/hooks/useStageAutomations';
import { EmailSequenceBuilder } from './EmailSequenceBuilder';
import { useMailIdentities } from '@/hooks/useMailIdentities';

interface AutomationFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jhsId: string;
  jobId: string;
  organizationId: string;
  existingAutomation?: StageAutomation | null;
}

const createDefaultEmail = (fromEmail: string): Omit<AutomationEmail, 'id' | 'template_name'> => ({
  sequence_order: 1,
  delay_value: null,
  delay_unit: null,
  is_recurring: false,
  recurrence_interval_value: null,
  recurrence_interval_unit: null,
  max_occurrences: 10,
  email_template_id: null,
  subject: '',
  body: '',
  from_email: fromEmail,
  send_to: 'candidate',
  custom_recipients: null
});

export function AutomationFormSheet({ 
  open, 
  onOpenChange, 
  jhsId,
  jobId,
  organizationId,
  existingAutomation
}: AutomationFormSheetProps) {
  const { createAutomation, updateAutomation } = useStageAutomations(jhsId);
  const { identities } = useMailIdentities();
  const defaultFromEmail = identities[0]?.email_address || '';
  
  const [automationType, setAutomationType] = useState<'single_email' | 'email_sequence'>('single_email');
  const [triggerEvent, setTriggerEvent] = useState<'on_stage_enter' | 'on_stage_exit'>('on_stage_enter');
  const [emails, setEmails] = useState<Omit<AutomationEmail, 'id' | 'template_name'>[]>([
    createDefaultEmail(defaultFromEmail)
  ]);
  
  const isEditMode = !!existingAutomation;
  
  // Initialize form with existing automation data when editing
  useEffect(() => {
    if (open && existingAutomation) {
      setAutomationType(existingAutomation.automation_type);
      setTriggerEvent(existingAutomation.trigger_event);
      setEmails(existingAutomation.emails.map(e => ({
        sequence_order: e.sequence_order,
        delay_value: e.delay_value,
        delay_unit: e.delay_unit,
        is_recurring: e.is_recurring,
        recurrence_interval_value: e.recurrence_interval_value,
        recurrence_interval_unit: e.recurrence_interval_unit,
        max_occurrences: e.max_occurrences,
        email_template_id: e.email_template_id,
        subject: e.subject,
        body: e.body,
        from_email: e.from_email,
        send_to: e.send_to,
        custom_recipients: e.custom_recipients
      })));
    } else if (open && !existingAutomation) {
      // Reset to defaults when opening in create mode
      setAutomationType('single_email');
      setTriggerEvent('on_stage_enter');
      setEmails([createDefaultEmail(defaultFromEmail)]);
    }
  }, [open, existingAutomation, defaultFromEmail]);
  
  const handleSave = async () => {
    if (isEditMode && existingAutomation) {
      await updateAutomation.mutateAsync({
        id: existingAutomation.id,
        automation_type: automationType,
        trigger_event: triggerEvent,
        emails
      });
    } else {
      await createAutomation.mutateAsync({
        job_hiring_stage_id: jhsId,
        automation_type: automationType,
        trigger_event: triggerEvent,
        emails
      });
    }
    onOpenChange(false);
  };
  
  const isValid = emails.every(e => e.subject && e.body && e.from_email);
  const isPending = createAutomation.isPending || updateAutomation.isPending;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-6xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Email Automation' : 'Create Email Automation'}</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Automation Type</Label>
              <Select value={automationType} onValueChange={(v: any) => setAutomationType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_email">Single Email</SelectItem>
                  <SelectItem value="email_sequence">Email Sequence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={triggerEvent} onValueChange={(v: any) => setTriggerEvent(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_stage_enter">When candidate enters stage</SelectItem>
                  <SelectItem value="on_stage_exit">When candidate exits stage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <EmailSequenceBuilder
            emails={emails}
            onChange={setEmails}
            organizationId={organizationId}
            jobId={jobId}
            isSingleEmail={automationType === 'single_email'}
          />
          </div>
        </div>
        
        <div className="border-t pt-4 mt-4 bg-background flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isPending || !isValid}
          >
            {isPending 
              ? (isEditMode ? 'Saving...' : 'Creating...') 
              : (isEditMode ? 'Save Changes' : 'Create Automation')
            }
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
