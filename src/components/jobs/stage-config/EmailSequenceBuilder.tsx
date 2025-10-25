import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, AlertTriangle, Repeat } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import type { AutomationEmail } from '@/hooks/useStageAutomations';

interface EmailSequenceBuilderProps {
  emails: Omit<AutomationEmail, 'id' | 'template_name'>[];
  onChange: (emails: Omit<AutomationEmail, 'id' | 'template_name'>[]) => void;
  organizationId: string;
  jobId: string;
  isSingleEmail: boolean;
}

export function EmailSequenceBuilder({ 
  emails, 
  onChange, 
  organizationId,
  isSingleEmail 
}: EmailSequenceBuilderProps) {
  const { templates } = useEmailTemplates('organization');
  const { identities } = useMailIdentities();
  
  const hasRecurringEmail = emails.some(e => e.is_recurring);
  const firstRecurringIndex = emails.findIndex(e => e.is_recurring);
  
  const addEmail = () => {
    if (hasRecurringEmail) return;
    
    onChange([
      ...emails,
      {
        sequence_order: emails.length + 1,
        delay_value: 1,
        delay_unit: 'days',
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
  };
  
  const removeEmail = (index: number) => {
    onChange(emails.filter((_, i) => i !== index));
  };
  
  const updateEmail = (index: number, updates: Partial<Omit<AutomationEmail, 'id' | 'template_name'>>) => {
    onChange(
      emails.map((email, i) => 
        i === index ? { ...email, ...updates } : email
      )
    );
  };
  
  const loadTemplate = (index: number, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      updateEmail(index, {
        email_template_id: templateId,
        subject: template.subject,
        body: template.body
      });
    }
  };
  
  return (
    <div className="space-y-4">
      {emails.map((email, index) => {
        const isDisabled = hasRecurringEmail && index > firstRecurringIndex;
        
        return (
          <Card key={index} className={`p-4 ${isDisabled ? 'opacity-50' : ''}`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Email {index + 1}</h4>
                {emails.length > 1 && !isDisabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEmail(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {isDisabled && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This email cannot be sent because Email {firstRecurringIndex + 1} is set to recurring.
                    Recurring emails prevent subsequent emails from being sent.
                  </AlertDescription>
                </Alert>
              )}
              
              {index > 0 && !isDisabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Delay from previous email</Label>
                    <Input
                      type="number"
                      min="1"
                      value={email.delay_value || ''}
                      onChange={(e) => updateEmail(index, { delay_value: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={email.delay_unit || 'days'}
                      onValueChange={(v: 'days' | 'weeks') => updateEmail(index, { delay_unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {!isDisabled && (
                <>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4" />
                      <Label className="cursor-pointer">Make this a recurring email</Label>
                    </div>
                    <Switch
                      checked={email.is_recurring}
                      onCheckedChange={(checked) => updateEmail(index, { is_recurring: checked })}
                    />
                  </div>
                  
                  {email.is_recurring && (
                    <>
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This email will repeat until the candidate moves stages or the job closes.
                          No emails after this one will be sent.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Repeat every</Label>
                          <Input
                            type="number"
                            min="1"
                            value={email.recurrence_interval_value || ''}
                            onChange={(e) => updateEmail(index, { 
                              recurrence_interval_value: parseInt(e.target.value) 
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit</Label>
                          <Select
                            value={email.recurrence_interval_unit || 'days'}
                            onValueChange={(v: 'days' | 'weeks') => 
                              updateEmail(index, { recurrence_interval_unit: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="weeks">Weeks</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Max sends (optional)</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="10"
                            value={email.max_occurrences || ''}
                            onChange={(e) => updateEmail(index, { 
                              max_occurrences: e.target.value ? parseInt(e.target.value) : null 
                            })}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Load from template (optional)</Label>
                    <Select onValueChange={(v) => loadTemplate(index, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Select
                      value={email.from_email}
                      onValueChange={(v) => updateEmail(index, { from_email: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {identities.map(identity => (
                          <SelectItem key={identity.id} value={identity.email_address}>
                            {identity.email_address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={email.subject}
                      onChange={(e) => updateEmail(index, { subject: e.target.value })}
                      placeholder="Email subject with {{placeholders}}"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Body</Label>
                    <RichTextEditor
                      value={email.body}
                      onChange={(v) => updateEmail(index, { body: v })}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>
        );
      })}
      
      {!isSingleEmail && !hasRecurringEmail && (
        <Button variant="outline" onClick={addEmail} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Email to Sequence
        </Button>
      )}
      
      {hasRecurringEmail && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Cannot add more emails because Email {firstRecurringIndex + 1} is set to recurring.
            Disable recurring on that email to add more to the sequence.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
