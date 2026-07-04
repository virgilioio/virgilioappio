import { useState, useRef, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useSendEmail, SendEmailRequest } from '@/hooks/useSendEmail';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import {
  Paperclip,
  X,
  Send,
  Mail,
  Sparkles,
  Bold,
  Italic,
  Underline,
  List,
  Link as LinkIcon,
  AtSign,
  Calendar,
  Bookmark,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';
import { normalizeToTemplateString } from '@/utils/templateStringNormalizer';
import { AIDraftPopover } from './AIDraftPopover';
import { cn } from '@/lib/utils';

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
  /** When true, renders as the docked-panel body (no card chrome, section layout with fixed footer). */
  docked?: boolean;
  jhsId?: string;
  associationId?: string;
  inReplyToMessageId?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultCc?: string;
  /** Notify the docked wrapper when a template chip should appear in the header. */
  onTemplateAppliedChange?: (applied: boolean) => void;
}

interface Attachment {
  file: File;
  name: string;
  size: number;
}

function initialsFor(name?: string | null, fallback = '?') {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback;
}

export function EmailComposer({
  candidateId,
  jobId,
  defaultTo,
  onSuccess,
  embedded = false,
  docked = false,
  jhsId,
  associationId,
  inReplyToMessageId,
  defaultSubject,
  defaultBody,
  defaultCc,
  onTemplateAppliedChange,
}: EmailComposerProps) {
  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useEmailTemplates('organization');
  const sendEmail = useSendEmail();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [bodyHtml, setBodyHtml] = useState(defaultBody || '');
  const [subjectHtml, setSubjectHtml] = useState(defaultSubject || '');
  const [showCC, setShowCC] = useState(!!defaultCc);
  const [showBCC, setShowBCC] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const splitAddrs = (s?: string) =>
    (s || '').split(/[,;\s]+/).map((v) => v.trim()).filter(Boolean);
  const [toChips, setToChips] = useState<string[]>(splitAddrs(defaultTo));
  const [ccChips, setCcChips] = useState<string[]>(splitAddrs(defaultCc));
  const [bccChips, setBccChips] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const activeIdentities = identities.filter((id) => id.is_active);

  useEffect(() => {
    onTemplateAppliedChange?.(!!selectedTemplateId);
  }, [selectedTemplateId, onTemplateAppliedChange]);

  const handleFormKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

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
      subject: defaultSubject || '',
      cc: defaultCc || '',
      bcc: '',
      body_html: defaultBody || '',
    },
  });

  const fromEmail = watch('from_email');
  const fromIdentity = activeIdentities.find((i) => i.email_address === fromEmail) || activeIdentities[0];

  // Keep RHF fields in sync with chip state
  useEffect(() => { setValue('to', toChips.join(', ')); }, [toChips, setValue]);
  useEffect(() => { setValue('cc', ccChips.join(', ')); }, [ccChips, setValue]);
  useEffect(() => { setValue('bcc', bccChips.join(', ')); }, [bccChips, setValue]);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];
    for (const file of files) {
      const totalSize = [...attachments, ...newAttachments].reduce((sum, a) => sum + a.size, 0);
      if (totalSize + file.size > 10 * 1024 * 1024) {
        toast.error('Total attachment size cannot exceed 10MB');
        break;
      }
      newAttachments.push({ file, name: file.name, size: file.size });
    }
    setAttachments([...attachments, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const parseEmailList = (emailString: string): string[] =>
    emailString.split(/[,;]/).map((e) => e.trim()).filter((e) => e.length > 0);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onSubmit = async (data: EmailFormData) => {
    const attachmentPromises = attachments.map(async (att) => ({
      filename: att.name,
      content: await fileToBase64(att.file),
      content_type: att.file.type || 'application/octet-stream',
    }));
    const processedAttachments = await Promise.all(attachmentPromises);

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
      jhs_id: jhsId,
      association_id: associationId,
      in_reply_to_message_id: inReplyToMessageId,
    };

    await sendEmail.mutateAsync(request);

    setBodyHtml('');
    setSubjectHtml('');
    setAttachments([]);
    setShowCC(false);
    setShowBCC(false);
    setSelectedTemplateId(null);
    setValue('subject', '');
    setCcChips([]);
    setBccChips([]);
    if (!defaultTo) setToChips([]);


    await new Promise((resolve) => setTimeout(resolve, 500));
    onSuccess?.();
  };

  const handleDiscard = () => {
    onSuccess?.();
  };

  if (loadingIdentities) {
    return (
      <div className="p-6 text-center" style={{ color: '#5A6072', fontSize: 12.5 }}>
        Loading email accounts...
      </div>
    );
  }

  if (activeIdentities.length === 0) {
    return (
      <div className="p-6 text-center space-y-3">
        <Mail className="h-6 w-6 mx-auto" style={{ color: '#8B8F9E' }} />
        <p style={{ fontSize: 13, color: '#1F2230', fontFamily: 'Inter' }}>
          Connect your email account to send messages
        </p>
        <Link to="/settings?tab=email">
          <Button variant="secondary" size="sm">
            <Mail className="h-4 w-4" />
            Connect Mailbox
          </Button>
        </Link>
      </div>
    );
  }

  const appliedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // ────────────────────────────────────────────────────────────
  // DOCKED LAYOUT — new visual system
  // ────────────────────────────────────────────────────────────
  if (docked) {
    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleFormKeyDown}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Recipient + meta block */}
        <div className="shrink-0" style={{ padding: '8px 16px 0' }}>
          {/* From */}
          <MetaRow
            label="From"
            hairline
            right={
              <ChevronDown className="h-3 w-3" style={{ color: '#8B8F9E' }} />
            }
          >
            <Select value={fromEmail} onValueChange={(v) => setValue('from_email', v)}>
              <SelectTrigger
                className="border-0 shadow-none bg-transparent p-0 h-auto hover:bg-transparent focus:ring-0 focus-visible:ring-0 [&>svg]:hidden"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold shrink-0"
                    style={{ background: '#EDE4FF', color: '#5B21B6' }}
                  >
                    {initialsFor(fromIdentity?.display_name || fromIdentity?.email_address)}
                  </div>
                  <span
                    className="truncate"
                    style={{ fontSize: 12.5, color: '#1F2230', fontFamily: 'Inter' }}
                  >
                    {fromEmail}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {activeIdentities.map((identity) => (
                  <SelectItem key={identity.id} value={identity.email_address}>
                    {identity.display_name} ({identity.email_address})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MetaRow>

          {/* To */}
          <MetaRow
            label="To"
            hairline
            right={
              <div className="flex items-center gap-2">
                {!showCC && (
                  <button
                    type="button"
                    onClick={() => setShowCC(true)}
                    style={{ fontSize: 11, fontWeight: 500, color: '#6F3FF5', fontFamily: 'Inter' }}
                  >
                    Cc
                  </button>
                )}
                {!showBCC && (
                  <>
                    <span style={{ color: '#8B8F9E', fontSize: 11 }}>·</span>
                    <button
                      type="button"
                      onClick={() => setShowBCC(true)}
                      style={{ fontSize: 11, fontWeight: 500, color: '#6F3FF5', fontFamily: 'Inter' }}
                    >
                      Bcc
                    </button>
                  </>
                )}
              </div>
            }
          >
            <ChipInput
              value={toChips}
              onChange={setToChips}
              placeholder="Add recipient…"
            />
          </MetaRow>

          {showCC && (
            <MetaRow
              label="Cc"
              hairline
              right={
                <button
                  type="button"
                  onClick={() => {
                    setShowCC(false);
                    setCcChips([]);
                  }}
                  style={{ color: '#8B8F9E' }}
                >
                  <X className="h-3 w-3" />
                </button>
              }
            >
              <ChipInput
                value={ccChips}
                onChange={setCcChips}
                placeholder="Add recipient…"
              />
            </MetaRow>
          )}
          {showBCC && (
            <MetaRow
              label="Bcc"
              hairline
              right={
                <button
                  type="button"
                  onClick={() => {
                    setShowBCC(false);
                    setBccChips([]);
                  }}
                  style={{ color: '#8B8F9E' }}
                >
                  <X className="h-3 w-3" />
                </button>
              }
            >
              <ChipInput
                value={bccChips}
                onChange={setBccChips}
                placeholder="Add recipient…"
              />
            </MetaRow>
          )}

          {/* Subject */}
          <MetaRow label="Subject" hairline={!!appliedTemplate}>
            <input
              type="text"
              value={subjectHtml}
              onChange={(e) => {
                setSubjectHtml(e.target.value);
                setValue('subject', e.target.value);
              }}
              placeholder="Subject"
              className="w-full bg-transparent border-0 outline-none p-0 placeholder:text-[#8B8F9E]"
              style={{ fontSize: 12.5, color: '#1F2230', fontFamily: 'Inter', fontWeight: 500 }}
            />
          </MetaRow>



          {/* Template */}
          {appliedTemplate && (
            <MetaRow
              label="Template"
              hairline={false}
              right={
                <TemplatePicker
                  templates={templates}
                  loading={loadingTemplates}
                  value={selectedTemplateId}
                  onChange={(id) => applyTemplate(id, templates, setSelectedTemplateId, setSubjectHtml, setBodyHtml, setValue)}
                  trigger={
                    <span
                      style={{ fontSize: 11, fontWeight: 500, color: '#6F3FF5', fontFamily: 'Inter' }}
                    >
                      Change
                    </span>
                  }
                />
              }
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: '#EDE4FF',
                  color: '#5B21B6',
                  fontSize: 11,
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {appliedTemplate.name}
              </span>
            </MetaRow>
          )}
        </div>

        {/* Body region (scrolls) */}
        <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '12px 16px' }}>
          {/* Toolbar */}
          <div
            className="flex items-center gap-0.5 mb-2.5"
            style={{
              padding: '5px 8px',
              background: '#FAFAF7',
              border: '1px solid #E7E8EE',
              borderRadius: 7,
            }}
          >
            <ToolbarIcon icon={<Bold className="h-3.5 w-3.5" />} label="Bold" />
            <ToolbarIcon icon={<Italic className="h-3.5 w-3.5" />} label="Italic" />
            <ToolbarIcon icon={<Underline className="h-3.5 w-3.5" />} label="Underline" />
            <ToolbarDivider />
            <ToolbarIcon icon={<List className="h-3.5 w-3.5" />} label="List" />
            <ToolbarIcon icon={<LinkIcon className="h-3.5 w-3.5" />} label="Link" />
            <ToolbarDivider />
            {!appliedTemplate && templates.length > 0 && (
              <TemplatePicker
                templates={templates}
                loading={loadingTemplates}
                value={selectedTemplateId}
                onChange={(id) => applyTemplate(id, templates, setSelectedTemplateId, setSubjectHtml, setBodyHtml, setValue)}
                trigger={
                  <span
                    className="inline-flex items-center gap-1 h-6 px-2 rounded hover:bg-white transition-colors"
                    style={{ color: '#5A6072', fontSize: 11, fontFamily: 'Inter' }}
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    Templates
                  </span>
                }
              />
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 h-6 px-2 rounded hover:bg-white transition-colors"
              style={{ color: '#5A6072', fontSize: 11, fontFamily: 'Inter' }}
            >
              <AtSign className="h-2.5 w-2.5" />
              Variables
            </button>
            <div className="flex-1" />
            {candidateId && jobId && (
              <AIDraftPopover
                candidateId={candidateId}
                jobId={jobId}
                senderName={fromIdentity?.display_name || undefined}
                onInsert={(subject, body) => {
                  setSubjectHtml(subject);
                  setValue('subject', subject);
                  const templateBody = normalizeToTemplateString(body);
                  setBodyHtml(templateBody);
                  setValue('body_html', templateBody);
                }}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md transition-colors"
                  style={{
                    background: '#EDE4FF',
                    color: '#5B21B6',
                    fontSize: 11,
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 500,
                  }}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Rewrite
                </button>
              </AIDraftPopover>
            )}
          </div>

          {/* Editor */}
          <div
            className="[&_.lexical-root]:min-h-[260px] [&_.lexical-root]:outline-none [&>div]:border-[#E0DDD3] [&>div]:rounded-lg"
          >
            <BodyTemplateEditor
              value={bodyHtml}
              onChange={(content) => {
                setBodyHtml(content);
                setValue('body_html', content);
              }}
              placeholder="Write your message…"
              hideToolbar
              minHeight="260px"
            />
          </div>


          {errors.body_html && (
            <p className="mt-2" style={{ fontSize: 11, color: 'hsl(var(--destructive))' }}>
              {errors.body_html.message}
            </p>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {attachments.map((att, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5"
                  style={{
                    background: '#FAFAF7',
                    border: '1px solid #E7E8EE',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    color: '#1F2230',
                    fontFamily: 'Inter',
                  }}
                >
                  <Paperclip className="h-3 w-3" style={{ color: '#5A6072' }} />
                  <span className="truncate max-w-[160px]">{att.name}</span>
                  <span style={{ color: '#8B8F9E' }}>
                    {(att.size / 1024).toFixed(0)}kb
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="ml-0.5"
                    style={{ color: '#8B8F9E' }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 shrink-0"
          style={{
            padding: '10px 16px',
            borderTop: '1px solid #F1F0EC',
            background: '#FAFAF7',
          }}
        >
          <FooterIcon
            icon={<Paperclip className="h-3.5 w-3.5" />}
            label="Attach files"
            onClick={() => fileInputRef.current?.click()}
          />
          <FooterIcon icon={<Calendar className="h-3.5 w-3.5" />} label="Insert availability" />
          <FooterIcon icon={<Bookmark className="h-3.5 w-3.5" />} label="Save as template" />
          <div className="flex-1" />
          <span style={{ fontSize: 10.5, color: '#8B8F9E', fontFamily: 'Inter' }}>
            ⌘↵ to send
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDiscard}
            disabled={sendEmail.isPending}
          >
            Discard
          </Button>
          <Button type="submit" size="sm" disabled={sendEmail.isPending}>
            {sendEmail.isPending ? (
              'Sending…'
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send
              </>
            )}
          </Button>
        </div>
      </form>
    );
  }

  // ────────────────────────────────────────────────────────────
  // LEGACY / EMBEDDED / CARD LAYOUT — preserved for other callers
  // ────────────────────────────────────────────────────────────
  const legacyForm = (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">From</label>
        <Select value={fromEmail} onValueChange={(v) => setValue('from_email', v)}>
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
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">To</label>
        <Input {...register('to')} placeholder="recipient@example.com" />
        {errors.to && <p className="text-sm text-destructive">{errors.to.message}</p>}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Subject</label>
        <SubjectTemplateEditor
          id="subject"
          value={subjectHtml}
          onChange={(value) => {
            setSubjectHtml(value);
            setValue('subject', value);
          }}
          placeholder="Email subject"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Message</label>
        <BodyTemplateEditor
          value={bodyHtml}
          onChange={(content) => {
            setBodyHtml(content);
            setValue('body_html', content);
          }}
          placeholder="Write your email message here..."
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">⌘↵ to send</span>
        <Button type="submit" disabled={sendEmail.isPending}>
          {sendEmail.isPending ? 'Sending...' : (<><Send className="h-4 w-4" />Send Email</>)}
        </Button>
      </div>
    </form>
  );

  if (embedded) return legacyForm;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Send Email
        </CardTitle>
        <CardDescription>Compose and send an email to the candidate</CardDescription>
      </CardHeader>
      <CardContent>{legacyForm}</CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function MetaRow({
  label,
  children,
  right,
  hairline,
}: {
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  hairline: boolean;
}) {
  return (
    <div
      className={cn('grid items-center gap-3')}
      style={{
        gridTemplateColumns: '60px 1fr auto',
        padding: '6px 0',
        borderBottom: hairline ? '1px solid #F1F0EC' : 'none',
      }}
    >
      <div
        className="text-right"
        style={{ fontSize: 11, color: '#8B8F9E', fontFamily: 'Inter' }}
      >
        {label}
      </div>
      <div className="min-w-0">{children}</div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function ToolbarIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded hover:bg-white transition-colors"
      style={{ color: '#5A6072' }}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div style={{ width: 1, height: 16, background: '#E0DDD3', margin: '0 4px' }} />;
}

function FooterIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white transition-colors"
      style={{ color: '#5A6072' }}
    >
      {icon}
    </button>
  );
}

function TemplatePicker({
  templates,
  loading,
  value,
  onChange,
  trigger,
}: {
  templates: Array<{ id: string; name: string; subject: string; body: string; source?: string }>;
  loading: boolean;
  value: string | null;
  onChange: (id: string | null) => void;
  trigger: React.ReactNode;
}) {
  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : v)}
      disabled={loading}
    >
      <SelectTrigger
        className="border-0 shadow-none bg-transparent p-0 h-auto w-auto hover:bg-transparent focus:ring-0 focus-visible:ring-0 [&>svg]:hidden"
      >
        {trigger}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No template</SelectItem>
        {templates.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function applyTemplate(
  id: string | null,
  templates: Array<{ id: string; subject: string; body: string }>,
  setSelectedTemplateId: (id: string | null) => void,
  setSubjectHtml: (v: string) => void,
  setBodyHtml: (v: string) => void,
  setValue: (name: 'subject' | 'body_html', v: string) => void,
) {
  if (!id) {
    setSelectedTemplateId(null);
    return;
  }
  const t = templates.find((x) => x.id === id);
  if (!t) return;
  setSelectedTemplateId(id);
  const subjectNormalized = convertHtmlToPlaceholders(t.subject);
  const bodyNormalized = convertHtmlToPlaceholders(t.body);
  setSubjectHtml(subjectNormalized);
  setValue('subject', subjectNormalized);
  setBodyHtml(bodyNormalized);
  setValue('body_html', bodyNormalized);
  toast.success('Template applied');
}
