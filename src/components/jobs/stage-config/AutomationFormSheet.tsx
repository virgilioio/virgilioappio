import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStageAutomations, type AutomationEmail } from '@/hooks/useStageAutomations';
import { EmailSequenceBuilder } from './EmailSequenceBuilder';
import { useMailIdentities } from '@/hooks/useMailIdentities';

interface AutomationFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jhsId: string;
  jobId: string;
  organizationId: string;
}

export function AutomationFormSheet({ 
  open, 
  onOpenChange, 
  jhsId,
  jobId,
  organizationId 
}: AutomationFormSheetProps) {
  const { createAutomation } = useStageAutomations(jhsId);
  const { identities } = useMailIdentities();
  const [automationType, setAutomationType] = useState<'single_email' | 'email_sequence'>('single_email');
  const [triggerEvent, setTriggerEvent] = useState<'on_stage_enter' | 'on_stage_exit'>('on_stage_enter');
  const [emails, setEmails] = useState<Omit<AutomationEmail, 'id' | 'template_name'>[]>([
    {
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
      from_email: identities[0]?.email_address || '',
      send_to: 'candidate',
      custom_recipients: null
    }
  ]);
  
  const handleSave = async () => {
    await createAutomation.mutateAsync({
      job_hiring_stage_id: jhsId,
      automation_type: automationType,
      trigger_event: triggerEvent,
      emails
    });
    onOpenChange(false);
  };
  
  const isValid = emails.every(e => e.subject && e.body && e.from_email);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Email Automation</SheetTitle>
        </SheetHeader>
        
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
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={createAutomation.isPending || !isValid}
          >
            {createAutomation.isPending ? 'Creating...' : 'Create Automation'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
