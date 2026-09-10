import { useMemo, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Quote, Link2, Braces, Paperclip, X, Eye, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors';
import type { SubjectTemplateEditorHandle, BodyTemplateEditorHandle, BodyEditorCommand } from '@/components/editors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { menuPanel, menuItem, menuGroupLabel } from '@/lib/menu-classes';
import { cn } from '@/lib/utils';
import {
  COMPOSER_VARIABLES, ATTACHMENT_TOTAL_LIMIT, formatBytes,
  type AutomationEmailStep, type AttachmentRef,
} from '@/lib/automations';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';
import { renderTemplate as previewTemplate } from "@/utils/templateUtils";

const LABEL: React.CSSProperties = { fontSize: 11, color: '#8B8F9E', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 };

interface Props {
  step: AutomationEmailStep;
  onChange: (next: AutomationEmailStep) => void;
  from: string;
  onFromChange: (v: string) => void;
  identities: { email_address: string; display_name?: string | null }[];
  cc: string[];
  bcc: string[];
  onCcChange: (v: string[]) => void;
  onBccChange: (v: string[]) => void;
  templates: { id: string; name: string; subject: string; body: string }[];
  templateId: string | null;
  onTemplateChange: (id: string | null) => void;
  /** Scope for attachment storage paths. */
  jobId: string;
  automationKey: string;
  /** Label shown above the fields, e.g. "Email 2 · 3 days after Email 1". */
  heading?: string;
  /** Hide From/CC/template — used for sequence steps after the first. */
  compact?: boolean;
  previewCandidateName?: string;
}

export function AutomationEmailComposer({
  step, onChange, from, onFromChange, identities, cc, bcc, onCcChange, onBccChange,
  templates, templateId, onTemplateChange, jobId, automationKey, heading, compact, previewCandidateName,
}: Props) {
  const subjectRef = useRef<SubjectTemplateEditorHandle>(null);
  const bodyRef = useRef<BodyTemplateEditorHandle>(null);
  const lastFocused = useRef<'subject' | 'body'>('body');
  const [varOpen, setVarOpen] = useState(false);
  const [varQuery, setVarQuery] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showCc, setShowCc] = useState(cc.length > 0 || bcc.length > 0);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalBytes = step.attachments.reduce((n, a) => n + (a.size || 0), 0);

  const filteredVars = useMemo(() => {
    const q = varQuery.trim().toLowerCase();
    return COMPOSER_VARIABLES.filter((v) => !q || v.label.toLowerCase().includes(q) || v.key.includes(q));
  }, [varQuery]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof filteredVars>();
    for (const v of filteredVars) m.set(v.group, [...(m.get(v.group) || []), v]);
    return Array.from(m.entries());
  }, [filteredVars]);

  const insertVariable = (key: string) => {
    if (lastFocused.current === 'subject') subjectRef.current?.insertPlaceholder(key);
    else bodyRef.current?.insertPlaceholder(key);
    setVarOpen(false);
    setVarQuery('');
  };

  const exec = (c: BodyEditorCommand, arg?: string) => bodyRef.current?.exec(c, arg);

  const applyTemplate = (id: string) => {
    if (id === '__none') { onTemplateChange(null); return; }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    onTemplateChange(id);
    onChange({ ...step, subject: convertHtmlToPlaceholders(t.subject), body_html: convertHtmlToPlaceholders(t.body) });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const incomingBytes = incoming.reduce((n, f) => n + f.size, 0);
    if (totalBytes + incomingBytes > ATTACHMENT_TOTAL_LIMIT) {
      toast.error(`Attachments can't exceed ${formatBytes(ATTACHMENT_TOTAL_LIMIT)} per email`);
      return;
    }
    setUploading(true);
    try {
      const refs: AttachmentRef[] = [];
      for (const f of incoming) {
        const path = `${jobId}/${automationKey}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
        const { error } = await supabase.storage.from('automation-attachments').upload(path, f, { contentType: f.type || undefined });
        if (error) throw error;
        refs.push({ file_id: path, name: f.name, size: f.size, content_type: f.type });
      }
      onChange({ ...step, attachments: [...step.attachments, ...refs] });
    } catch (e: any) {
      toast.error(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAttachment = async (ref: AttachmentRef) => {
    onChange({ ...step, attachments: step.attachments.filter((a) => a.file_id !== ref.file_id) });
    await supabase.storage.from('automation-attachments').remove([ref.file_id]).catch(() => null);
  };

  const sample = {
    'candidate.first_name': (previewCandidateName || 'Alex Rivera').split(' ')[0],
    'candidate.full_name': previewCandidateName || 'Alex Rivera',
    'candidate.name': previewCandidateName || 'Alex Rivera',
    'candidate.email': 'alex@example.com',
    'job.title': 'Senior Product Designer',
    'job.department': 'Design',
    'job.location': 'Mexico City',
    'job.salary_range': 'MXN 80,000 – 110,000',
    'client.name': 'Acme',
    'stage.name': 'Screening',
    'recruiter.first_name': 'Sam',
    'sender.first_name': 'Sam',
    'sender.name': 'Sam Ortega',
    'interview.datetime': 'Tue 14 Oct · 10:00',
    'scheduling.link': 'https://app.gogio.io/book/…',
  };

  const ToolBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-7 w-7 rounded-md inline-flex items-center justify-center hover:bg-[#F1F0EC]"
      style={{ color: '#5A6072' }}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E6E0', background: '#fff' }}>
      {heading && (
        <div className="px-4 py-2.5 font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09', borderBottom: '1px solid #F1F0EC', background: '#FAFAF7' }}>
          {heading}
        </div>
      )}

      {!compact && (
        <div className="px-4 pt-3 space-y-2" style={{ borderBottom: '1px solid #F1F0EC', paddingBottom: 12 }}>
          <Row label="From">
            <Select value={from || undefined} onValueChange={onFromChange}>
              <SelectTrigger className="h-8 text-[12.5px]"><SelectValue placeholder="Choose a connected mailbox" /></SelectTrigger>
              <SelectContent>
                {identities.map((i) => (
                  <SelectItem key={i.email_address} value={i.email_address}>
                    {i.display_name ? `${i.display_name} <${i.email_address}>` : i.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="font-inter shrink-0 hover:underline" style={{ fontSize: 12, color: '#6F3FF5' }}>
                CC / BCC
              </button>
            )}
          </Row>
          {showCc && (
            <>
              <Row label="CC"><ChipInput value={cc} onChange={onCcChange} /></Row>
              <Row label="BCC"><ChipInput value={bcc} onChange={onBccChange} /></Row>
            </>
          )}
          <Row label="Template">
            <Select value={templateId || '__none'} onValueChange={applyTemplate}>
              <SelectTrigger className="h-8 text-[12.5px]"><SelectValue placeholder="Start from a template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Blank</SelectItem>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
        </div>
      )}

      {/* Subject */}
      <div className="px-4 pt-3">
        <div style={LABEL} className="font-inter mb-1">Subject</div>
        <SubjectTemplateEditor
          ref={subjectRef}
          value={step.subject}
          onChange={(v) => onChange({ ...step, subject: v })}
          placeholder="Subject line"
          onFocus={() => { lastFocused.current = 'subject'; }}
        />
      </div>

      {/* Toolbar */}
      <div className="px-3 pt-2 flex items-center gap-0.5">
        <ToolBtn title="Bold" onClick={() => exec('bold')}><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Italic" onClick={() => exec('italic')}><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Underline" onClick={() => exec('underline')}><Underline className="h-3.5 w-3.5" /></ToolBtn>
        <span className="mx-1 h-4 w-px" style={{ background: '#E8E6E0' }} />
        <ToolBtn title="Bulleted list" onClick={() => exec('ul')}><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Numbered list" onClick={() => exec('ol')}><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Quote" onClick={() => exec('quote')}><Quote className="h-3.5 w-3.5" /></ToolBtn>
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="Link" aria-label="Link" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 rounded-md inline-flex items-center justify-center hover:bg-[#F1F0EC]" style={{ color: '#5A6072' }}>
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-[300px] p-2 z-[1300]">
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); exec('link', linkUrl.trim()); setLinkOpen(false); setLinkUrl(''); }}
            >
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="h-8 text-[12.5px]" autoFocus />
              <Button type="submit" size="sm">Apply</Button>
            </form>
          </PopoverContent>
        </Popover>
        <span className="mx-1 h-4 w-px" style={{ background: '#E8E6E0' }} />
        <Popover open={varOpen} onOpenChange={(o) => { setVarOpen(o); if (!o) setVarQuery(''); }}>
          <PopoverTrigger asChild>
            <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 px-2 rounded-md inline-flex items-center gap-1.5 font-inter hover:bg-[#F1F0EC]" style={{ fontSize: 12, color: '#6F3FF5' }}>
              <Braces className="h-3.5 w-3.5" /> Insert variable
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className={cn(menuPanel, 'w-[280px] p-0 z-[1300]')}>
            <div className="flex items-center gap-2 px-3 h-9" style={{ borderBottom: '1px solid #F1F0EC' }}>
              <Search className="h-3.5 w-3.5" style={{ color: '#8B8F9E' }} />
              <input
                autoFocus
                value={varQuery}
                onChange={(e) => setVarQuery(e.target.value)}
                placeholder="Search variables"
                className="flex-1 bg-transparent outline-none font-inter"
                style={{ fontSize: 12.5 }}
              />
            </div>
            <div className="p-1 max-h-[280px] overflow-y-auto">
              {groups.length === 0 && <div className="px-3 py-2 font-inter" style={{ fontSize: 12.5, color: '#8B8F9E' }}>No matches</div>}
              {groups.map(([group, vars]) => (
                <div key={group}>
                  <div className={menuGroupLabel}>{group}</div>
                  {vars.map((v) => (
                    <button key={v.key} type="button" className={cn(menuItem, 'w-full justify-between')} onClick={() => insertVariable(v.key)}>
                      <span>{v.label}</span>
                      <span className="font-mono" style={{ fontSize: 10.5, color: '#8B8F9E' }}>{`{{${v.key}}}`}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={cn('h-7 px-2 rounded-md inline-flex items-center gap-1.5 font-inter hover:bg-[#F1F0EC]', preview && 'bg-[#EDE4FF]')}
          style={{ fontSize: 12, color: '#5A6072' }}
        >
          <Eye className="h-3.5 w-3.5" /> {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 pt-1">
        {preview ? (
          <div className="rounded-lg p-4 font-inter" style={{ border: '1px solid #E8E6E0', background: '#FAFAF7', fontSize: 13, color: '#0d0d09', minHeight: 200 }}>
            <div className="font-poppins mb-3" style={{ fontSize: 13.5, fontWeight: 600 }}>
              {previewTemplate(step.subject, sample as any) || <span style={{ color: '#8B8F9E' }}>No subject</span>}
            </div>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTemplate(step.body_html, sample as any) }} />
            <div className="mt-3 font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>Preview uses sample values. Real sends use each candidate's data.</div>
          </div>
        ) : (
          <BodyTemplateEditor
            ref={bodyRef}
            value={step.body_html}
            onChange={(v) => onChange({ ...step, body_html: v })}
            placeholder="Write your email…"
            hideToolbar
            minHeight="200px"
            maxHeight="420px"
            onFocus={() => { lastFocused.current = 'body'; }}
          />
        )}

        {/* Attachments */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {step.attachments.map((a) => (
            <span key={a.file_id} className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md font-inter" style={{ background: '#F1F0EC', fontSize: 11.5, color: '#0d0d09' }}>
              <Paperclip className="h-3 w-3" style={{ color: '#8B8F9E' }} />
              <span className="max-w-[180px] truncate">{a.name}</span>
              <span style={{ color: '#8B8F9E' }}>{formatBytes(a.size)}</span>
              <button type="button" aria-label={`Remove ${a.name}`} onClick={() => removeAttachment(a)} className="h-4 w-4 rounded inline-flex items-center justify-center hover:bg-[#E8E6E0]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="h-6 px-2 rounded-md inline-flex items-center gap-1.5 font-inter hover:bg-[#F1F0EC] disabled:opacity-50"
            style={{ fontSize: 11.5, color: '#5A6072' }}
          >
            <Paperclip className="h-3 w-3" /> {uploading ? 'Uploading…' : 'Attach file'}
          </button>
          <span className="font-inter ml-auto" style={{ fontSize: 11, color: totalBytes > ATTACHMENT_TOTAL_LIMIT * 0.9 ? '#E0891A' : '#8B8F9E' }}>
            {formatBytes(totalBytes)} / {formatBytes(ATTACHMENT_TOTAL_LIMIT)}
          </span>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="font-inter w-[64px] shrink-0" style={LABEL}>{label}</div>
      <div className="flex-1 flex items-center gap-3 min-w-0">{children}</div>
    </div>
  );
}

function ChipInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => /\S+@\S+\.\S+/.test(s));
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])));
    setDraft('');
  };
  return (
    <div className="flex-1 flex flex-wrap items-center gap-1 min-h-8 px-2 py-1 rounded-md" style={{ border: '1px solid #E8E6E0' }}>
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 h-5 px-1.5 rounded font-inter" style={{ background: '#F1F0EC', fontSize: 11.5 }}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); commit(); } }}
        placeholder={value.length ? '' : 'name@company.com'}
        className="flex-1 min-w-[120px] bg-transparent outline-none font-inter"
        style={{ fontSize: 12.5 }}
      />
    </div>
  );
}
