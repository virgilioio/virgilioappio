import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { X, Minus, Maximize2, Mail, Sparkles } from 'lucide-react';
import { EmailComposer } from '@/components/candidates/EmailComposer';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { reopenDraft, type EmailDraft } from '@/lib/emailOutbox';

interface MinimizableEmailComposerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
  jobId?: string;
  defaultTo?: string;
  candidateName?: string;
  onSuccess?: () => void;
  jhsId?: string;
  associationId?: string;
  mode?: 'compose' | 'reply' | 'forward';
  inReplyToMessageId?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultCc?: string;
  /** Bulk mode: composes one email personalized for each candidate on this job. */
  bulk?: { candidateIds: string[]; jobId: string };
  /** Optional job title shown as sub-line in bulk mode header. */
  bulkJobTitle?: string;
  /** Undo Send: the draft to reopen (EmailOutboxHost). */
  initialDraft?: EmailDraft;
  /** Opens as the minimized strip (a draft whose page went away, EmailOutboxHost). */
  startMinimized?: boolean;
  /** When the page holding an open composer goes away, its draft moves to
   *  EmailOutboxHost, minimized (default). EmailOutboxHost's own composers don't. */
  keepOnUnmount?: boolean;
}

// Minimized strips sit side by side from the right; an open panel keeps its corner.
const strips: string[] = [];
const open = new Set<string>();
const dockListeners = new Set<() => void>();
let dockVersion = 0;
const dockEmit = () => { dockVersion++; dockListeners.forEach((l) => l()); };
const dockSubscribe = (fn: () => void) => { dockListeners.add(fn); return () => { dockListeners.delete(fn); }; };
const dockSnapshot = () => dockVersion;
function setDocked(id: string, state: 'strip' | 'open' | null) {
  const i = strips.indexOf(id);
  if (i >= 0) strips.splice(i, 1);
  open.delete(id);
  if (state === 'strip') strips.push(id);
  if (state === 'open') open.add(id);
  dockEmit();
}
const STRIP_W = 360;
const PANEL_W = 680;
const GAP = 12;

export function MinimizableEmailComposer({
  isOpen,
  onOpenChange,
  candidateId,
  jobId,
  defaultTo,
  candidateName,
  onSuccess,
  jhsId,
  associationId,
  mode = 'compose',
  inReplyToMessageId,
  defaultSubject,
  defaultBody,
  defaultCc,
  bulk,
  bulkJobTitle,
  initialDraft,
  startMinimized = false,
  keepOnUnmount = true,
}: MinimizableEmailComposerProps) {
  const [isMinimized, setIsMinimized] = useState(startMinimized);
  const [templateApplied, setTemplateApplied] = useState(false);
  const isPhone = useIsMobile();
  const dockId = useId();
  useSyncExternalStore(dockSubscribe, dockSnapshot, dockSnapshot);

  // The draft as it stands (EmailComposer fills it in), and whether it was closed on
  // purpose: an open composer whose page goes away keeps its draft (2026-11-24).
  const draftRef = useRef<(() => { draft: EmailDraft; changed: boolean }) | null>(null);
  const requestCloseRef = useRef<(() => void) | null>(null);
  const closedRef = useRef(false);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  useEffect(() => {
    if (isOpen) closedRef.current = false;
  }, [isOpen]);
  useEffect(() => {
    return () => {
      if (!keepOnUnmount || !openRef.current || closedRef.current) return;
      const now = draftRef.current?.();
      if (now?.changed) reopenDraft(now.draft, { minimized: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const docked: 'strip' | 'open' | null = !isOpen || isPhone ? null : isMinimized ? 'strip' : 'open';
  useEffect(() => {
    setDocked(dockId, docked);
    return () => setDocked(dockId, null);
  }, [dockId, docked]);

  if (!isOpen) return null;

  const close = () => {
    closedRef.current = true;
    onOpenChange(false);
  };
  // The ×: a written email asks in the composer's footer first (shown, if minimized).
  const askClose = () => {
    if (!requestCloseRef.current) return close();
    setIsMinimized(false);
    requestCloseRef.current();
  };
  const stripIndex = Math.max(0, strips.indexOf(dockId));
  const stripRight = 16 + (open.size > 0 ? PANEL_W + GAP : 0) + stripIndex * (STRIP_W + GAP);

  const draftContext = { candidateName, mode, bulkJobTitle };

  const handleSuccess = () => {
    closedRef.current = true;
    onSuccess?.();
    onOpenChange(false);
  };

  const title = bulk
    ? `New email · ${bulk.candidateIds.length} recipient${bulk.candidateIds.length === 1 ? '' : 's'}`
    : mode === 'reply'
    ? `Reply to ${candidateName || 'candidate'}`
    : mode === 'forward'
    ? 'Forward email'
    : 'New email';

  const subLine = bulk ? (bulkJobTitle || '') : (defaultSubject || (candidateName ? `To ${candidateName}` : ''));

  // --- Phone (2026-11-11): the composer is a full-screen page (no minimize) ---
  if (isPhone) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="gio-composer-phone fixed z-[70] flex flex-col bg-virgilio-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <EmailComposer
          candidateId={candidateId}
          jobId={jobId}
          defaultTo={defaultTo}
          onSuccess={handleSuccess}
          embedded
          docked
          phone
          onClose={close}
          jhsId={jhsId}
          associationId={associationId}
          inReplyToMessageId={inReplyToMessageId}
          defaultSubject={defaultSubject}
          defaultBody={defaultBody}
          defaultCc={defaultCc}
          onTemplateAppliedChange={setTemplateApplied}
          bulk={bulk}
          initialDraft={initialDraft}
          draftContext={draftContext}
          draftRef={draftRef}
        />
      </div>
    );
  }

  // --- Open state: full docked panel ---
  return (
    <>
      {!isMinimized && (
        <div
          className="fixed inset-0 z-[59] pointer-events-none"
          style={{ background: 'rgba(13,13,9,0.04)' }}
          aria-hidden
        />
      )}
      {isMinimized && (
        <div
          className="fixed bottom-4 z-[60] w-[360px] rounded-[10px] overflow-hidden pointer-events-auto"
          style={{
            right: stripRight,
            boxShadow:
              '0 12px 32px -8px rgba(13,13,9,0.18), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
            style={{ background: '#0d0d09' }}
            onClick={() => setIsMinimized(false)}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
              style={{ background: 'rgba(255,252,249,0.08)' }}
            >
              <Mail className="h-3 w-3" style={{ color: '#fffcf9' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-poppins font-semibold truncate"
                style={{ fontSize: 12, color: '#fffcf9', letterSpacing: '-0.01em' }}
              >
                {title}
              </div>
              {subLine && (
                <div
                  className="truncate"
                  style={{
                    fontSize: 11,
                    fontFamily: 'Inter, sans-serif',
                    color: 'rgba(255,252,249,0.6)',
                    marginTop: 1,
                  }}
                >
                  {subLine}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Expand"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,252,249,0.7)' }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                askClose();
              }}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,252,249,0.7)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* Minimized, the panel is only hidden: the editor stays mounted, so nothing typed is lost. */}
      <div
        className={cn(
          'fixed bottom-4 right-4 z-[60] flex flex-col overflow-hidden pointer-events-auto',
          'bg-white',
          isMinimized && 'hidden'
        )}
        aria-hidden={isMinimized || undefined}
        style={{
          width: 680,
          maxWidth: 'min(95vw, 680px)',
          height: 'min(84vh, 720px)',
          borderRadius: 14,
          border: '1px solid #E7E8EE',
          boxShadow:
            '0 24px 64px -12px rgba(13,13,9,0.28), 0 0 0 1px rgba(13,13,9,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark header */}
        <div
          className="flex items-center gap-2 shrink-0"
          style={{ background: '#0d0d09', padding: '10px 14px' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Mail className="h-[13px] w-[13px]" style={{ color: '#fffcf9' }} />
              <span
                className="font-poppins font-semibold truncate"
                style={{ fontSize: 13, color: '#fffcf9', letterSpacing: '-0.01em' }}
              >
                {title}
              </span>
              {templateApplied && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{
                    background: '#EDE4FF',
                    color: '#5B21B6',
                    fontSize: 10.5,
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 500,
                    marginLeft: 4,
                  }}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Gio template
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => setIsMinimized(true)}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,252,249,0.7)' }}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={askClose}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,252,249,0.7)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body region — composer handles recipient block, editor, footer */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <EmailComposer
            candidateId={candidateId}
            jobId={jobId}
            defaultTo={defaultTo}
            onSuccess={handleSuccess}
            embedded
            docked
            jhsId={jhsId}
            associationId={associationId}
            inReplyToMessageId={inReplyToMessageId}
            defaultSubject={defaultSubject}
            defaultBody={defaultBody}
            defaultCc={defaultCc}
            onTemplateAppliedChange={setTemplateApplied}
            bulk={bulk}
            initialDraft={initialDraft}
            draftContext={draftContext}
            draftRef={draftRef}
            requestCloseRef={requestCloseRef}
            onClose={close}
          />
        </div>
      </div>
    </>
  );
}
