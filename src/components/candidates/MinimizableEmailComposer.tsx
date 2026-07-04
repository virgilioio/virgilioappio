import { useState } from 'react';
import { X, Minus, Maximize2, Mail, Sparkles } from 'lucide-react';
import { EmailComposer } from '@/components/candidates/EmailComposer';
import { cn } from '@/lib/utils';

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
}

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
}: MinimizableEmailComposerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);

  if (!isOpen) return null;

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  const title =
    mode === 'reply'
      ? `Reply to ${candidateName || 'candidate'}`
      : mode === 'forward'
      ? 'Forward email'
      : 'New email';

  const subLine = defaultSubject || (candidateName ? `To ${candidateName}` : '');

  // --- Minimized state: compact dark strip ---
  if (isMinimized) {
    return (
      <>
        {/* Non-blocking soft scrim */}
        <div
          className="fixed inset-0 z-[59] pointer-events-none"
          style={{ background: 'rgba(13,13,9,0.04)' }}
          aria-hidden
        />
        <div
          className="fixed bottom-4 right-4 z-[60] w-[360px] rounded-[10px] overflow-hidden pointer-events-auto"
          style={{
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
                onOpenChange(false);
              }}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,252,249,0.7)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // --- Open state: full docked panel ---
  return (
    <>
      <div
        className="fixed inset-0 z-[59] pointer-events-none"
        style={{ background: 'rgba(13,13,9,0.04)' }}
        aria-hidden
      />
      <div
        className={cn(
          'fixed bottom-4 right-4 z-[60] flex flex-col overflow-hidden pointer-events-auto',
          'bg-white'
        )}
        style={{
          width: 620,
          maxWidth: 'min(95vw, 620px)',
          height: 'min(760px, 90vh)',
          maxHeight: 'min(760px, 90vh)',
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
            onClick={() => onOpenChange(false)}
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
          />
        </div>
      </div>
    </>
  );
}
