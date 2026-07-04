import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Loader2,
  X,
  Info,
  Reply,
  GitBranch,
  Calendar,
  Clock,
  PartyPopper,
  Heart,
  Minimize2,
  Feather,
  SpellCheck,
  Maximize2,
} from 'lucide-react';
import { useAIDraftEmail } from '@/hooks/useAIDraftEmail';
import { toast } from 'sonner';

interface AIDraftPopoverProps {
  candidateId?: string;
  senderName?: string;
  jobId?: string;
  /** Current body HTML — when non-empty the panel switches to Rewrite mode. */
  currentBody?: string;
  onInsert: (subject: string, body: string) => void;
  children: React.ReactNode;
}

type ChipDef = { label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>; prompt: string };

const DRAFT_CHIPS: ChipDef[] = [
  { label: 'Follow-up', icon: Reply, prompt: 'Write a friendly follow-up email to check on the candidate and keep them engaged.' },
  { label: 'Process update', icon: GitBranch, prompt: 'Write an email updating the candidate on where they are in our hiring process and what comes next.' },
  { label: 'Schedule interview', icon: Calendar, prompt: 'Write an email to invite the candidate to schedule their next interview round.' },
  { label: 'Request availability', icon: Clock, prompt: 'Write an email asking the candidate for their availability for upcoming interviews.' },
  { label: 'Share good news', icon: PartyPopper, prompt: 'Write a positive email letting the candidate know we\'d like to move them forward to the next stage.' },
];

const REWRITE_CHIPS: ChipDef[] = [
  { label: 'Make warmer', icon: Heart, prompt: 'Rewrite the following email to sound warmer, more personal, and empathetic while keeping the meaning and length similar.' },
  { label: 'More concise', icon: Minimize2, prompt: 'Rewrite the following email to be significantly more concise without losing any key information.' },
  { label: 'More formal', icon: Feather, prompt: 'Rewrite the following email in a more formal, professional tone suitable for executive candidates.' },
  { label: 'Fix grammar', icon: SpellCheck, prompt: 'Correct any grammar, spelling, or punctuation issues in the following email. Preserve tone and meaning.' },
  { label: 'Expand', icon: Maximize2, prompt: 'Expand the following email with helpful detail, keeping the tone consistent and staying on topic.' },
];

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function AIDraftPopover({
  candidateId,
  jobId,
  onInsert,
  senderName,
  currentBody,
  children,
}: AIDraftPopoverProps) {
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const draftMutation = useAIDraftEmail();
  const isGenerating = draftMutation.isPending;

  const plainBody = stripHtml(currentBody || '');
  const isRewrite = plainBody.length > 0;
  const chips = isRewrite ? REWRITE_CHIPS : DRAFT_CHIPS;

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCustomPrompt('');
      setActiveChip(null);
    }
  }, [open]);

  const runGenerate = async (basePrompt: string, chipLabel: string | null) => {
    if (!candidateId || !jobId) {
      toast.error('Missing candidate or job context');
      return;
    }
    const finalPrompt = isRewrite
      ? `${basePrompt}\n\n--- Current email body ---\n${plainBody}`
      : basePrompt;

    try {
      setActiveChip(chipLabel);
      const result = await draftMutation.mutateAsync({
        candidateId,
        jobId,
        prompt: finalPrompt,
        senderName: senderName || undefined,
      });
      onInsert(result.subject, result.body);
      setOpen(false);
      setCustomPrompt('');
      setActiveChip(null);
    } catch (error) {
      toast.error('Failed to generate. Please try again.');
      console.error('AI draft error:', error);
      setActiveChip(null);
    }
  };

  const handleChip = (chip: ChipDef) => {
    if (isGenerating) return;
    runGenerate(chip.prompt, chip.label);
  };

  const handleCustom = () => {
    if (!customPrompt.trim() || isGenerating) return;
    const base = isRewrite
      ? `Rewrite the following email based on this instruction: ${customPrompt.trim()}`
      : customPrompt.trim();
    runGenerate(base, null);
  };

  // Track trigger rect to position portal panel
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 400;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
      setCoords({ top: r.bottom + 8, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <div
        ref={triggerRef}
        onClick={() => !isGenerating && setOpen((v) => !v)}
        className="inline-flex"
      >
        {children}
      </div>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={isRewrite ? 'Rewrite with Gio' : 'Draft with Gio'}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: 400,
            background: '#FFFFFF',
            border: '1px solid #E7E8EE',
            borderRadius: 14,
            boxShadow:
              '0 24px 64px -12px rgba(13,13,9,0.28), 0 0 0 1px rgba(13,13,9,0.04)',
            overflow: 'hidden',
            zIndex: 9999,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center"
            style={{
              padding: '13px 16px',
              borderBottom: '1px solid #F1F0EC',
              background: 'linear-gradient(180deg, #FAF8FF, #ffffff)',
              gap: 11,
            }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{ height: 26, width: 26, borderRadius: 7, background: '#6F3FF5' }}
            >
              <Sparkles style={{ height: 14, width: 14, color: '#fff' }} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center" style={{ gap: 7 }}>
                <span
                  className="font-poppins"
                  style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2230' }}
                >
                  {isRewrite ? 'Rewrite with Gio' : 'Draft with Gio'}
                </span>
                <Badge tone="lilac" size="xs">Gio</Badge>
              </div>
              <div
                className="font-inter"
                style={{ marginTop: 2, fontSize: 11, color: '#5A6072' }}
              >
                {isRewrite
                  ? 'Pick a rewrite style or tell Gio what to change.'
                  : 'Pick a starting point or tell Gio what to write.'}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center shrink-0"
              style={{ height: 24, width: 24, borderRadius: 6, background: 'transparent', color: '#8B8F9E', border: 0 }}
            >
              <X style={{ height: 14, width: 14 }} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '14px 16px 16px' }}>
            <div
              className="font-inter"
              style={{
                marginBottom: 9,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: '#8B8F9E',
              }}
            >
              {isRewrite ? 'Rewrite actions' : 'Quick starts'}
            </div>

            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {chips.map((chip) => {
                const Icon = chip.icon;
                const busy = isGenerating && activeChip === chip.label;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleChip(chip)}
                    disabled={isGenerating}
                    className="inline-flex items-center transition-colors font-inter group"
                    style={{
                      height: 30,
                      padding: '0 12px',
                      borderRadius: 999,
                      border: '1px solid #E7E8EE',
                      background: '#FFFFFF',
                      color: '#1F2230',
                      fontSize: 12,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      gap: 7,
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      opacity: isGenerating && !busy ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (isGenerating) return;
                      e.currentTarget.style.background = '#EDE4FF';
                      e.currentTarget.style.color = '#5B21B6';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#FFFFFF';
                      e.currentTarget.style.color = '#1F2230';
                      e.currentTarget.style.borderColor = '#E7E8EE';
                    }}
                  >
                    {busy ? (
                      <Loader2 style={{ height: 12, width: 12, color: '#6F3FF5' }} className="animate-spin" />
                    ) : (
                      <Icon className="shrink-0" style={{ height: 12, width: 12, color: '#6F3FF5' }} />
                    )}
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* OR divider */}
            <div className="flex items-center" style={{ margin: '14px 0', gap: 10 }}>
              <span style={{ flex: 1, height: 1, background: '#F1F0EC' }} />
              <span
                className="font-inter"
                style={{ fontSize: 10, fontWeight: 500, color: '#8B8F9E', letterSpacing: '0.05em' }}
              >
                OR
              </span>
              <span style={{ flex: 1, height: 1, background: '#F1F0EC' }} />
            </div>

            {/* Prompt textarea */}
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder={
                isRewrite
                  ? 'e.g. Tighten the second paragraph and add a warm closing…'
                  : 'e.g. Invite them to a final-round interview next week…'
              }
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#6F3FF5';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(111,63,245,0.10)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E0DDD3';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleCustom();
                }
              }}
              className="w-full font-inter outline-none resize-none placeholder:text-[#B5B9C4]"
              style={{
                border: '1.5px solid #E0DDD3',
                borderRadius: 10,
                padding: 12,
                minHeight: 72,
                fontSize: 12.5,
                color: '#1F2230',
                background: '#fff',
                transition: 'border-color 120ms, box-shadow 120ms',
              }}
            />

            {/* Generate / Rewrite button */}
            <button
              type="button"
              onClick={handleCustom}
              disabled={isGenerating || !customPrompt.trim()}
              className="w-full inline-flex items-center justify-center font-poppins transition-opacity"
              style={{
                marginTop: 10,
                height: 40,
                borderRadius: 9,
                background: '#6F3FF5',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                border: 0,
                gap: 7,
                cursor: isGenerating || !customPrompt.trim() ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.45 : !customPrompt.trim() ? 0.55 : 1,
              }}
            >
              {isGenerating && activeChip === null ? (
                <>
                  <Loader2 style={{ height: 14, width: 14 }} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles style={{ height: 14, width: 14 }} strokeWidth={2} />
                  {isRewrite ? 'Rewrite' : 'Generate draft'}
                </>
              )}
            </button>

            {/* Footnote */}
            <div
              className="flex items-center justify-center font-inter"
              style={{ marginTop: 10, gap: 5, fontSize: 10.5, color: '#8B8F9E' }}
            >
              <Info style={{ height: 11, width: 11 }} strokeWidth={2} />
              Gio uses this candidate's profile &amp; stage as context.
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
