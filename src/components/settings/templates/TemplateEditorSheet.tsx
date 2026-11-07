import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UnsavedGuard } from '@/components/ui/unsaved-guard';
import { FormSheet } from '@/components/references/FormSheet';
import {
  SubjectTemplateEditor,
  BodyTemplateEditor,
  VariableMenu,
  TemplatePreview,
  PreviewToggle,
  type SubjectTemplateEditorHandle,
  type BodyTemplateEditorHandle,
} from '@/components/editors';
import { AIDraftPopover, RewriteButton } from '@/components/candidates/AIDraftPopover';
import { COMPOSER_VARIABLES } from '@/lib/automations';
import { shakeFirstInvalid } from '@/lib/motion';
import { convertHtmlToPlaceholders } from '@/utils/placeholderUtils';
import { cn } from '@/lib/utils';

/**
 * The Settings template editor (2026-11-07): email templates and rejection email
 * templates in the stage automation composer's look. One column; the variables sit
 * in the editor itself ({ } Variable on the Subject, Insert variable in the body's
 * toolbar, beside Rewrite with Gio and Preview); a sticky footer with Cancel and
 * Save, and "Discard unsaved changes?" in place when closing with changes.
 */
export interface TemplateDraft {
  name: string;
  subject: string;
  body: string;
}

interface TemplateEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template being edited; undefined for a new one. */
  initial?: TemplateDraft;
  eyebrow: string;
  /** e.g. "email template" → "New email template" / "Edit email template". */
  noun: string;
  namePlaceholder: string;
  subjectPlaceholder: string;
  purpose: 'template' | 'rejection';
  onSave: (draft: TemplateDraft) => Promise<void>;
}

const EMPTY: TemplateDraft = { name: '', subject: '', body: '' };

// Formatting-only differences the editors make on load don't count as changes.
const norm = (s: string) =>
  convertHtmlToPlaceholders(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
const same = (a: TemplateDraft, b: TemplateDraft) =>
  a.name.trim() === b.name.trim() && norm(a.subject) === norm(b.subject) && norm(a.body) === norm(b.body);
const textOf = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

export function TemplateEditorSheet({
  open, onOpenChange, initial, eyebrow, noun, namePlaceholder, subjectPlaceholder, purpose, onSave,
}: TemplateEditorSheetProps) {
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY);
  const [baseline, setBaseline] = useState<TemplateDraft>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const subjectRef = useRef<SubjectTemplateEditorHandle>(null);
  const bodyRef = useRef<BodyTemplateEditorHandle>(null);
  const bodyRoot = useRef<HTMLDivElement>(null);

  // A fresh start each time it opens (or the template it's editing arrives).
  const initialKey = initial ? `${initial.name}\u0000${initial.subject}\u0000${initial.body}` : '';
  useEffect(() => {
    if (!open) return;
    const start = initial ?? EMPTY;
    setDraft(start);
    setBaseline(start);
    setPreview(false);
    setTried(false);
    setError(null);
    setAsking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  const dirty = open && !same(draft, baseline);
  const problem = !draft.name.trim()
    ? 'Name the template'
    : !textOf(draft.subject)
      ? 'Write the subject'
      : !textOf(draft.body)
        ? 'Write the email'
        : null;
  const message = error ?? (tried ? problem : null);

  const close = () => {
    if (saving) return;
    if (dirty) setAsking(true);
    else onOpenChange(false);
  };

  const submit = async () => {
    setTried(true);
    setError(null);
    if (problem) {
      if (!draft.name.trim()) shakeFirstInvalid(bodyRoot.current);
      else if (!textOf(draft.subject)) subjectRef.current?.focus?.();
      else bodyRef.current?.focus();
      return;
    }
    try {
      setSaving(true);
      await onSave({ ...draft, name: draft.name.trim() });
      onOpenChange(false);
    } catch {
      setError('Couldn’t save it. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      width={880}
      eyebrow={eyebrow}
      title={initial ? `Edit ${noun}` : `New ${noun}`}
      subtitle="Variables fill in with each candidate’s details when the email goes out."
      footer={
        <div className="relative flex w-full items-center gap-2.5">
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <p
            key={message ?? 'ready'}
            className={cn('gio-swap-in min-w-0 flex-1 truncate font-inter text-[11.5px]', message ? 'text-virgilio-error' : 'text-text-tertiary')}
          >
            {message ?? ''}
          </p>
          <Button icon={Check} onClick={() => void submit()} loading={saving} className="min-w-[96px]">
            Save
          </Button>
          <UnsavedGuard
            open={asking}
            onKeep={() => setAsking(false)}
            onDiscard={() => {
              setAsking(false);
              onOpenChange(false);
            }}
          />
        </div>
      }
    >
      <div ref={bodyRoot} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder={namePlaceholder}
            aria-invalid={tried && !draft.name.trim() ? true : undefined}
          />
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E6E0', background: '#fff' }}>
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="template-subject">Subject</Label>
              <VariableMenu variant="subject" variables={COMPOSER_VARIABLES} onInsert={(k) => subjectRef.current?.insertPlaceholder(k)} />
            </div>
            <SubjectTemplateEditor
              ref={subjectRef}
              id="template-subject"
              variables={COMPOSER_VARIABLES}
              value={draft.subject}
              onChange={(v) => setDraft((d) => ({ ...d, subject: v }))}
              placeholder={subjectPlaceholder}
            />
          </div>

          <div className="px-4 pb-4 pt-3">
            {preview ? (
              <>
                <div className="flex items-center justify-end mb-1.5">
                  <PreviewToggle preview={preview} onToggle={() => setPreview(false)} />
                </div>
                <TemplatePreview subject={draft.subject} body={draft.body} />
              </>
            ) : (
              <BodyTemplateEditor
                ref={bodyRef}
                variables={COMPOSER_VARIABLES}
                value={draft.body}
                onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
                placeholder="Write your email…"
                ariaLabel="Email body"
                minHeight="240px"
                maxHeight="460px"
                toolbarExtra={
                  <>
                    <VariableMenu variant="toolbar" variables={COMPOSER_VARIABLES} onInsert={(k) => bodyRef.current?.insertPlaceholder(k)} />
                    <div className="flex-1" />
                    <AIDraftPopover
                      template={{ purpose, subject: draft.subject, variables: COMPOSER_VARIABLES }}
                      currentBody={draft.body}
                      onInsert={(subject, body) => setDraft((d) => ({ ...d, subject: subject || d.subject, body }))}
                    >
                      <RewriteButton empty={!textOf(draft.body)} />
                    </AIDraftPopover>
                    <PreviewToggle preview={preview} onToggle={() => setPreview(true)} />
                  </>
                }
              />
            )}
          </div>
        </div>
      </div>
    </FormSheet>
  );
}
