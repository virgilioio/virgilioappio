import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import type { BodyTemplateEditorHandle } from '@/components/editors/BodyTemplateEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SplitButton } from '@/components/ui/split-button';
import { DateTimePickerVirgilio } from '@/components/ui/datetime-picker-virgilio';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useSendEmail, SendEmailRequest } from '@/hooks/useSendEmail';
import { useBulkSendEmail } from '@/hooks/useBulkSendEmail';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { AVAILABLE_PLACEHOLDERS } from '@/utils/placeholderUtils';
import { supabase } from '@/lib/supabaseClient';
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
  Users,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';
import { normalizeToTemplateString } from '@/utils/templateStringNormalizer';
import { AIDraftPopover } from './AIDraftPopover';
import { useAIDraftEmail } from '@/hooks/useAIDraftEmail';
import { BookingLinkPopover, type BookingCardPayload } from '@/components/chat/BookingLinkPopover';
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
  /** Enable bulk-send mode: composes one email personalized per candidate in the job. */
  bulk?: { candidateIds: string[]; jobId: string };
}

interface Attachment {
  file: File;
  name: string;
  size: number;
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
  bulk,
}: EmailComposerProps) {
  const isBulk = !!bulk;
  const { identities, isLoading: loadingIdentities } = useMailIdentities();
  const { templates, isLoading: loadingTemplates } = useEmailTemplates('organization');
  const sendEmail = useSendEmail();
  const bulkSend = useBulkSendEmail();
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

  // ── Bulk mode state ────────────────────────────────────────
  const [bulkAssociationIds, setBulkAssociationIds] = useState<string[]>([]);
  const [bulkRecipientNames, setBulkRecipientNames] = useState<string[]>([]);
  const [bulkSkippedNames, setBulkSkippedNames] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyEditorRef = useRef<BodyTemplateEditorHandle | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ title: string; reason: string; apply: () => void } | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const activeIdentities = identities.filter((id) => id.is_active);

  useEffect(() => {
    onTemplateAppliedChange?.(!!selectedTemplateId);
  }, [selectedTemplateId, onTemplateAppliedChange]);

  // Resolve bulk candidateIds → association IDs & names (skips those with no email).
  useEffect(() => {
    if (!bulk || bulk.candidateIds.length === 0) return;
    let cancelled = false;
    setBulkLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('id, candidate:candidates!inner(email, candidate_name)')
        .eq('job_id', bulk.jobId)
        .in('candidate_id', bulk.candidateIds);
      if (cancelled) return;
      if (error || !data) {
        setBulkLoading(false);
        return;
      }
      const withEmail: { id: string; name: string }[] = [];
      const skipped: string[] = [];
      for (const row of data as any[]) {
        const name = row.candidate?.candidate_name || 'Unknown';
        if (row.candidate?.email) withEmail.push({ id: row.id, name });
        else skipped.push(name);
      }
      setBulkAssociationIds(withEmail.map((w) => w.id));
      setBulkRecipientNames(withEmail.map((w) => w.name));
      setBulkSkippedNames(skipped);
      setBulkLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bulk?.jobId, bulk?.candidateIds.join(',')]);

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
    resolver: zodResolver(
      isBulk
        ? (emailSchema.extend({ to: z.string().optional().default('') }) as any)
        : emailSchema,
    ),
    defaultValues: {
      to: isBulk ? 'bulk' : (defaultTo || ''),
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

  const insertBookingLinkIntoBody = useCallback((payload: BookingCardPayload) => {
    const safeUrl = payload.url.replace(/"/g, '&quot;');
    const label = payload.title || payload.url;
    const snippet = `<p><a href="${safeUrl}">${label}</a><br/><span style="color:#8B8F9E;font-size:12px;">${payload.meta || ''}</span></p><p><br/></p>`;
    const next = (bodyHtml || '') + snippet;
    setBodyHtml(next);
    setValue('body_html', next);
  }, [bodyHtml, setValue]);

  // Lightweight suggestion trigger: once the body has substantive content, propose a warmer rewrite.
  const rewriteMutation = useAIDraftEmail();
  useEffect(() => {
    const text = (bodyHtml || '').replace(/<[^>]*>/g, '').trim();
    if (text.length < 120) {
      setAiSuggestion((prev) => (prev ? null : prev));
      return;
    }
    if (aiSuggestion) return;
    if (!candidateId || !jobId) return;
    setAiSuggestion({
      title: 'Make warmer',
      reason: 'A warmer tone often gets better response rates from candidates.',
      apply: async () => {
        try {
          const prompt = `Rewrite the following email to sound warmer, more personal, and empathetic. Keep the meaning and length similar.\n\n--- Current email body ---\n${text}`;
          const result = await rewriteMutation.mutateAsync({
            candidateId,
            jobId,
            prompt,
            senderName: fromIdentity?.display_name || undefined,
          });
          const templateBody = normalizeToTemplateString(result.body);
          setBodyHtml(templateBody);
          setValue('body_html', templateBody);
          if (result.subject) {
            setSubjectHtml(result.subject);
            setValue('subject', result.subject);
          }
        } catch {
          toast.error('Failed to rewrite. Please try again.');
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml, candidateId, jobId]);



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
    const subjectWithPlaceholders = convertHtmlToPlaceholders(subjectHtml);
    const bodyHtmlWithPlaceholders = convertHtmlToPlaceholders(bodyHtml);

    if (isBulk) {
      if (bulkAssociationIds.length === 0) {
        toast.error('No recipients with a valid email address.');
        return;
      }
      await bulkSend.sendBulkEmailAsync({
        associationIds: bulkAssociationIds,
        emailData: {
          fromEmail: data.from_email,
          subject: subjectWithPlaceholders,
          bodyHtml: bodyHtmlWithPlaceholders,
        },
        scheduleFor: scheduledAt || undefined,
      });
      onSuccess?.();
      return;
    }

    const attachmentPromises = attachments.map(async (att) => ({
      filename: att.name,
      content: await fileToBase64(att.file),
      content_type: att.file.type || 'application/octet-stream',
    }));
    const processedAttachments = await Promise.all(attachmentPromises);
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
              isBulk ? null : (
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
              )
            }
          >
            {isBulk ? (
              <BulkRecipientsPill
                loading={bulkLoading}
                count={bulkAssociationIds.length}
                names={bulkRecipientNames}
                skipped={bulkSkippedNames}
              />
            ) : (
              <ChipInput
                value={toChips}
                onChange={setToChips}
                placeholder="Add recipient…"
              />
            )}
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
              className="w-full bg-transparent border-0 outline-none p-0 placeholder:text-[#8B8F9E] placeholder:font-normal"
              style={{ fontSize: 12.5, color: '#1F2230', fontFamily: 'Inter', fontWeight: 400 }}
            />
          </MetaRow>




          {/* Template — always visible */}
          <MetaRow
            label="Template"
            hairline={false}
            right={
              appliedTemplate ? (
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
              ) : null
            }
          >
            {appliedTemplate ? (
              <Badge tone="purple" size="sm" icon={Sparkles}>
                {appliedTemplate.name}
              </Badge>
            ) : (
              <TemplatePicker
                templates={templates}
                loading={loadingTemplates}
                value={selectedTemplateId}
                onChange={(id) => applyTemplate(id, templates, setSelectedTemplateId, setSubjectHtml, setBodyHtml, setValue)}
                trigger={
                  <span
                    className="inline-flex items-center cursor-pointer hover:text-[#6F3FF5] transition-colors"
                    style={{ fontSize: 12, color: '#8B8F9E', fontFamily: 'Inter' }}
                  >
                    Choose a template…
                  </span>
                }
              />
            )}
          </MetaRow>
        </div>

        {/* Body region — flex column, editor grows to fill */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ padding: '12px 16px' }}>
          {/* Toolbar — single row, no wrap */}
          <div
            className="flex items-center gap-1 mb-2.5 shrink-0 flex-nowrap overflow-hidden"
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
            <VariablesPicker
              onSelect={(key) => bodyEditorRef.current?.insertPlaceholder(key)}
              trigger={
                <button
                  type="button"
                  className="inline-flex flex-nowrap items-center gap-1 h-6 px-2 rounded hover:bg-white transition-colors whitespace-nowrap shrink-0 leading-none"
                  style={{ color: '#5A6072', fontSize: 11, fontFamily: 'Inter' }}
                >
                  <AtSign className="h-3 w-3 shrink-0" />
                  <span className="whitespace-nowrap">Variables</span>
                </button>
              }
            />
            <div className="flex-1 min-w-0" />
            {candidateId && jobId && (
              <AIDraftPopover
                candidateId={candidateId}
                jobId={jobId}
                senderName={fromIdentity?.display_name || undefined}
                currentBody={bodyHtml}
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
                  className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md transition-colors whitespace-nowrap shrink-0"
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

          {/* Editor — grows to fill remaining space */}
          <div
            className={cn(
              'flex-1 min-h-0 flex flex-col',
              '[&>div]:flex-1 [&>div]:flex [&>div]:flex-col [&>div]:min-h-0',
              '[&>div]:border [&>div]:border-[#E0DDD3] [&>div]:rounded-lg [&>div]:bg-white',
              '[&_.lexical-root]:flex-1 [&_.lexical-root]:min-h-[220px] [&_.lexical-root]:outline-none [&_.lexical-root]:overflow-auto',
              '[&_.lexical-root]:text-[13px] [&_.lexical-root]:leading-[1.6] [&_.lexical-root]:text-[#1F2230]',
              '[&_.lexical-editor-placeholder]:!text-[13px] [&_.lexical-editor-placeholder]:!leading-[1.6] [&_.lexical-editor-placeholder]:!font-normal [&_.lexical-editor-placeholder]:!text-[#8B8F9E] [&_.lexical-editor-placeholder]:!top-3 [&_.lexical-editor-placeholder]:!left-3',
            )}
          >
            <BodyTemplateEditor
              ref={bodyEditorRef}
              value={bodyHtml}
              onChange={(content) => {
                setBodyHtml(content);
                setValue('body_html', content);
              }}
              placeholder="Write your message…"
              hideToolbar
              minHeight="220px"
            />
          </div>

          {/* Gio suggests — renders only when AI produces a real suggestion */}
          {aiSuggestion && (
            <div
              className="flex items-center gap-2.5 shrink-0"
              style={{
                marginTop: 10,
                padding: 10,
                background: 'linear-gradient(180deg, #FAF8FF, #ffffff)',
                border: '1px solid #EDE4FF',
                borderRadius: 8,
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 22, height: 22, borderRadius: 6, background: '#6F3FF5' }}
              >
                <Sparkles className="h-3 w-3" style={{ color: '#fff' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="truncate"
                  style={{ fontFamily: 'Poppins, sans-serif', fontSize: 11.5, fontWeight: 600, color: '#1F2230' }}
                >
                  Gio suggests · "{aiSuggestion.title}"
                </div>
                <div
                  className="truncate"
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: '#5A6072', marginTop: 1 }}
                >
                  {aiSuggestion.reason}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  aiSuggestion.apply();
                  setAiSuggestion(null);
                }}
                style={{ background: '#6F3FF5', color: '#fff' }}
              >
                Apply
              </Button>
              <button
                type="button"
                aria-label="Dismiss suggestion"
                onClick={() => setAiSuggestion(null)}
                className="shrink-0"
                style={{ color: '#8B8F9E' }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}





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

        {/* Bulk: schedule strip */}
        {isBulk && (scheduledAt || showScheduler) && (
          <div
            className="flex items-center gap-2 shrink-0"
            style={{
              padding: '8px 16px',
              borderTop: '1px solid #F1F0EC',
              background: '#FAF8FF',
            }}
          >
            <Clock className="h-3.5 w-3.5" style={{ color: '#5B21B6' }} />
            <span
              style={{ fontSize: 11.5, color: '#5B21B6', fontFamily: 'Poppins, sans-serif', fontWeight: 500 }}
            >
              Scheduled send
            </span>
            <div className="flex-1" />
            <DateTimePickerVirgilio
              value={scheduledAt || new Date(Date.now() + 60 * 60 * 1000)}
              onChange={(d) => setScheduledAt(d)}
              minDate={new Date()}
            />
            <button
              type="button"
              aria-label="Cancel schedule"
              onClick={() => {
                setScheduledAt(null);
                setShowScheduler(false);
              }}
              className="ml-1"
              style={{ color: '#8B8F9E' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Bulk: progress hairline */}
        {isBulk && bulkSend.isPending && bulkSend.progress.total > 0 && (
          <div className="shrink-0" style={{ height: 2, background: '#F1F0EC' }}>
            <div
              style={{
                height: '100%',
                width: `${((bulkSend.progress.completed + bulkSend.progress.failed) / bulkSend.progress.total) * 100}%`,
                background: '#6F3FF5',
                transition: 'width 200ms ease',
              }}
            />
          </div>
        )}

        {/* Footer */}
        <div
          className="relative flex items-center gap-2 shrink-0"
          style={{
            padding: '10px 16px',
            borderTop: '1px solid #F1F0EC',
            background: '#FAFAF7',
          }}
        >
          <BookingLinkPopover
            source={{ candidateId, jobId, associationId, jhsId }}
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            onPick={(payload) => {
              insertBookingLinkIntoBody(payload);
              setBookingOpen(false);
            }}
            anchorStyle={{ left: 12, right: 12, bottom: '100%', marginBottom: 8 }}
          />
          <FooterIcon
            icon={<Paperclip className="h-3.5 w-3.5" />}
            label="Attach files"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBulk}
          />
          <FooterIcon
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Insert booking link"
            onClick={() => setBookingOpen((v) => !v)}
          />
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
            disabled={sendEmail.isPending || bulkSend.isPending}
          >
            Discard
          </Button>
          {isBulk ? (
            <SplitButton
              size="sm"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={bulkSend.isPending || bulkAssociationIds.length === 0 || (showScheduler && !scheduledAt)}
              options={[
                {
                  label: scheduledAt ? 'Send immediately' : 'Schedule for later…',
                  onSelect: () => {
                    if (scheduledAt) {
                      setScheduledAt(null);
                      setShowScheduler(false);
                    } else {
                      setShowScheduler(true);
                      setScheduledAt(new Date(Date.now() + 60 * 60 * 1000));
                    }
                  },
                },
              ]}
            >
              {bulkSend.isPending ? (
                `Sending ${bulkSend.progress.completed + bulkSend.progress.failed}/${bulkSend.progress.total}…`
              ) : scheduledAt ? (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  {`Schedule ${bulkAssociationIds.length} email${bulkAssociationIds.length === 1 ? '' : 's'}`}
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {`Send ${bulkAssociationIds.length || ''} email${bulkAssociationIds.length === 1 ? '' : 's'}`.trim()}
                </>
              )}
            </SplitButton>
          ) : (
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
          )}
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

// Chip-input for recipients (To/Cc/Bcc). Commits on Enter, comma, Tab, blur, paste.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const parts = raw.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div
      className="flex flex-wrap items-center gap-1 cursor-text"
      style={{ minHeight: 28, padding: '2px 0' }}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((addr, i) => {
        const invalid = !EMAIL_RE.test(addr);
        return (
          <Badge
            key={`${addr}-${i}`}
            tone={invalid ? 'red' : 'neutral'}
            size="sm"
            icon={Mail}
            onRemove={() => removeAt(i)}
          >
            {addr}
          </Badge>
        );
      })}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
            if (draft.trim()) {
              e.preventDefault();
              commit(draft);
            }
          } else if (e.key === 'Backspace' && !draft && value.length) {
            e.preventDefault();
            removeAt(value.length - 1);
          }
        }}
        onBlur={() => { if (draft.trim()) commit(draft); }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[,;\s]/.test(text)) {
            e.preventDefault();
            commit(text);
          }
        }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent border-0 outline-none p-1 placeholder:text-[#8B8F9E]"
        style={{ fontSize: 12, color: '#1F2230', fontFamily: 'Inter' }}
      />
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

// Variables picker — surfaces the existing AVAILABLE_PLACEHOLDERS system
function VariablesPicker({
  onSelect,
  trigger,
}: {
  onSelect: (key: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const grouped = AVAILABLE_PLACEHOLDERS.reduce<Record<string, typeof AVAILABLE_PLACEHOLDERS>>(
    (acc, p) => {
      (acc[p.category] ||= []).push(p);
      return acc;
    },
    {},
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-1 max-h-[320px] overflow-auto"
      >
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-1 last:mb-0">
            <div
              className="px-2 pt-1.5 pb-1"
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#8B8F9E',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
              }}
            >
              {category}
            </div>
            {items.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onSelect(p.value);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#F1F0EC] transition-colors"
              >
                <span style={{ fontSize: 12.5, color: '#1F2230', fontFamily: 'Inter' }}>
                  {p.label}
                </span>
                <span
                  className="font-mono truncate max-w-[110px]"
                  style={{ fontSize: 10.5, color: '#8B8F9E' }}
                >
                  {p.value}
                </span>
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
