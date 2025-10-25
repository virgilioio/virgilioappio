import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useSendEmail, SendEmailRequest } from '@/hooks/useSendEmail';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { Paperclip, X, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { convertPlaceholdersToHtml, convertHtmlToPlaceholders, containsPlaceholders } from '@/utils/placeholderUtils';
import { SubjectInputWithBadges } from './SubjectInputWithBadges';

const emailSchema = z.object({
  from_email: z.string().email('Invalid email address'),
  to: z.string().min(1, 'At least one recipient is required'),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  body_html: z.string().min(1, 'Email body is required'),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface EmailComposerProps {
  candidateId?: string;
  jobId?: string;
  defaultTo?: string;
  onSuccess?: () => void;
  embedded?: boolean;
}

interface Attachment {
  file: File;
  name: string;
  size: number;
}

export function EmailComposer({ candidateId, jobId, defaultTo, onSuccess, embedded = false }: EmailComposerProps) {
  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useEmailTemplates('organization');
  const sendEmail = useSendEmail();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [bodyHtml, setBodyHtml] = useState('');
  const [subjectHtml, setSubjectHtml] = useState('');
  const [showCC, setShowCC] = useState(false);
  const [showBCC, setShowBCC] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeIdentities = identities.filter(id => id.is_active);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: defaultTo || '',
      from_email: activeIdentities[0]?.email_address || '',
      subject: '',
      cc: '',
      bcc: '',
      body_html: '',
    },
  });

  const fromEmail = watch('from_email');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];
    
    for (const file of files) {
      const totalSize = [...attachments, ...newAttachments].reduce((sum, a) => sum + a.size, 0);
      
      if (totalSize + file.size > 10 * 1024 * 1024) {
        toast.error('Total attachment size cannot exceed 10MB');
        break;
      }
      
      newAttachments.push({
        file,
        name: file.name,
        size: file.size,
      });
    }
    
    setAttachments([...attachments, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const parseEmailList = (emailString: string): string[] => {
    return emailString
      .split(/[,;]/)
      .map(e => e.trim())
      .filter(e => e.length > 0);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (data: EmailFormData) => {
    // Convert attachments to base64
    const attachmentPromises = attachments.map(async (att) => ({
      filename: att.name,
      content: await fileToBase64(att.file),
      content_type: att.file.type || 'application/octet-stream',
    }));

    const processedAttachments = await Promise.all(attachmentPromises);

    // Convert badge HTML back to placeholder text for backend processing
    const subjectWithPlaceholders = convertHtmlToPlaceholders(subjectHtml);
    const bodyHtmlWithPlaceholders = convertHtmlToPlaceholders(bodyHtml);
    const bodyTextWithPlaceholders = bodyHtmlWithPlaceholders.replace(/<[^>]*>/g, '');

    const request: SendEmailRequest = {
      from_email: data.from_email,
      to: parseEmailList(data.to),
      cc: data.cc ? parseEmailList(data.cc) : undefined,
      bcc: data.bcc ? parseEmailList(data.bcc) : undefined,
      subject: subjectWithPlaceholders,
      body_html: bodyHtmlWithPlaceholders,
      body_text: bodyTextWithPlaceholders,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
      candidate_id: candidateId,
      job_id: jobId,
    };

    await sendEmail.mutateAsync(request);
    
    // Reset form only on success (mutateAsync will throw on error)
    setBodyHtml('');
    setSubjectHtml('');
    setAttachments([]);
    setShowCC(false);
    setShowBCC(false);
    setSelectedTemplateId(null);
    setValue('subject', '');
    setValue('cc', '');
    setValue('bcc', '');
    if (!defaultTo) setValue('to', '');
    
    // Small delay to ensure toast is visible before closing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSuccess?.();
  };

  if (loadingIdentities) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Send Email</CardTitle>
          <CardDescription>Loading email accounts...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (activeIdentities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email
          </CardTitle>
          <CardDescription>
            Connect your email account to send messages to candidates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/settings?tab=email">
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Connect Mailbox
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* From */}
          <div className="space-y-2">
            <Label htmlFor="from_email">From</Label>
            <Select
              value={fromEmail}
              onValueChange={(value) => setValue('from_email', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select email account" />
              </SelectTrigger>
              <SelectContent>
                {activeIdentities.map((identity) => (
                  <SelectItem key={identity.id} value={identity.email_address}>
                    {identity.display_name} ({identity.email_address})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.from_email && (
              <p className="text-sm text-destructive">{errors.from_email.message}</p>
            )}
          </div>

          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="template">Email Template (Optional)</Label>
            <Select
              value={selectedTemplateId || '__none__'}
              onValueChange={(value) => {
                if (value === '__none__') {
                  setSelectedTemplateId(null);
                } else {
                  setSelectedTemplateId(value);
                  const template = templates.find(t => t.id === value);
                  if (template) {
                    // Convert placeholders to badges in subject and body
                    const subjectWithBadges = convertPlaceholdersToHtml(template.subject);
                    const bodyWithBadges = convertPlaceholdersToHtml(template.body);
                    
                    setSubjectHtml(subjectWithBadges);
                    setValue('subject', subjectWithBadges);
                    setBodyHtml(bodyWithBadges);
                    setValue('body_html', bodyWithBadges);
                    toast.success('Template applied - placeholders shown as badges');
                  }
                }
              }}
              disabled={loadingTemplates}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No template</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      {template.source === 'platform' && (
                        <Badge variant="outline" className="text-xs">
                          Platform
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Templates can include placeholders like {'{{'}candidate.name{'}}'}
            </p>
          </div>

          {/* To */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              {...register('to')}
              placeholder="recipient@example.com, another@example.com"
            />
            {errors.to && (
              <p className="text-sm text-destructive">{errors.to.message}</p>
            )}
            
            {/* CC/BCC Toggle Links */}
            <div className="flex gap-3 text-xs">
              {!showCC && (
                <button
                  type="button"
                  onClick={() => setShowCC(true)}
                  className="text-text-tertiary hover:text-text-primary transition-colors underline"
                >
                  CC
                </button>
              )}
              {!showBCC && (
                <button
                  type="button"
                  onClick={() => setShowBCC(true)}
                  className="text-text-tertiary hover:text-text-primary transition-colors underline"
                >
                  BCC
                </button>
              )}
            </div>
          </div>

          {/* CC - Conditional */}
          {showCC && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cc">CC</Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCC(false);
                    setValue('cc', '');
                  }}
                  className="text-text-tertiary hover:text-destructive transition-colors"
                  title="Remove CC field"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Input
                id="cc"
                {...register('cc')}
                placeholder="cc@example.com"
              />
            </div>
          )}

          {/* BCC - Conditional */}
          {showBCC && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bcc">BCC</Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowBCC(false);
                    setValue('bcc', '');
                  }}
                  className="text-text-tertiary hover:text-destructive transition-colors"
                  title="Remove BCC field"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Input
                id="bcc"
                {...register('bcc')}
                placeholder="bcc@example.com"
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <SubjectInputWithBadges
              id="subject"
              value={subjectHtml}
              onChange={(html) => {
                setSubjectHtml(html);
                setValue('subject', html);
              }}
              placeholder="Email subject"
            />
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject.message}</p>
            )}
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message</Label>
            <RichTextEditor
              value={bodyHtml}
              onChange={(content) => {
                setBodyHtml(content);
                setValue('body_html', content);
              }}
              placeholder="Write your email message here..."
            />
            {containsPlaceholders(bodyHtml) && (
              <p className="text-xs text-primary bg-primary/10 border border-primary/30 rounded px-2 py-1">
                ✨ Colored badges represent placeholders that will be automatically replaced with candidate/job information when sent
              </p>
            )}
            {errors.body_html && (
              <p className="text-sm text-destructive">{errors.body_html.message}</p>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm"
                >
                  <Paperclip className="h-3 w-3" />
                  <span>{att.name}</span>
                  <span className="text-muted-foreground">
                    ({(att.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Attach Files
            </Button>
            <p className="text-xs text-muted-foreground">
              Maximum 10MB total for all attachments
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={sendEmail.isPending}
            >
              {sendEmail.isPending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </form>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Send Email
        </CardTitle>
        <CardDescription>
          Compose and send an email to the candidate
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
