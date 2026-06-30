import { useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface DraftWithGioPopoverProps {
  threadId: string
  disabled?: boolean
  onUseDraft: (text: string) => void
}

type Tone = 'friendly' | 'direct' | 'enthusiastic' | 'apologetic'

const TONES: { id: Tone; label: string }[] = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'direct', label: 'Direct' },
  { id: 'enthusiastic', label: 'Enthusiastic' },
  { id: 'apologetic', label: 'Apologetic' },
]

/**
 * DraftWithGioPopover — Step 3.4
 *
 * Recruiter-only popover that asks the chat-ai-draft edge function for a
 * suggested reply. The recruiter can swap tone, add an instruction, regenerate,
 * and "Use draft" to pipe the text into the composer textarea.
 */
export function DraftWithGioPopover({ threadId, disabled, onUseDraft }: DraftWithGioPopoverProps) {
  const [open, setOpen] = useState(false)
  const [tone, setTone] = useState<Tone | undefined>(undefined)
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai-draft', {
        body: {
          threadId,
          tone,
          instruction: instruction.trim() || undefined,
        },
      })
      if (error) throw error
      const text = (data as { draft?: string })?.draft?.trim()
      if (!text) throw new Error('No draft returned')
      setDraft(text)
    } catch (e: any) {
      toast.error(e?.message || 'Could not draft a reply right now.')
    } finally {
      setLoading(false)
    }
  }

  const useDraft = () => {
    if (!draft) return
    onUseDraft(draft)
    setOpen(false)
    // Reset for next invocation but keep tone/instruction the recruiter chose.
    setDraft(null)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setDraft(null)
          setLoading(false)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          icon={Sparkles}
          disabled={disabled}
          className="text-[#5B3FBF] hover:bg-[#EDE4FF]"
        >
          Draft with Gio
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[380px] p-3 rounded-xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] border-virgilio-border"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-6 rounded-md bg-[#EDE4FF] text-[#5B3FBF] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="font-poppins font-semibold text-[12.5px] tracking-[-0.01em] text-virgilio-text">
            Draft with Gio
          </span>
        </div>

        {/* Tone chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {TONES.map((t) => {
            const active = tone === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(active ? undefined : t.id)}
                className={cn(
                  'inline-flex items-center h-6 px-2 rounded-md transition-colors',
                  'font-poppins font-medium text-[11px] tracking-[-0.005em]',
                  active
                    ? 'bg-[#EDE4FF] text-[#5B3FBF]'
                    : 'text-text-secondary hover:bg-[#F1F0EC]',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Optional instruction */}
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: tell Gio what to focus on (e.g. confirm Friday 3pm)…"
          rows={2}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-virgilio-border bg-surface-primary px-2.5 py-2 text-[12.5px] font-inter text-virgilio-text outline-none focus:ring-2 focus:ring-virgilio-purple/30 placeholder:text-text-secondary"
        />

        {/* Result */}
        <div className="mt-2 min-h-[88px] rounded-lg bg-[#FAF8FF] border border-virgilio-border p-2.5">
          {loading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-9/12" />
            </div>
          ) : draft ? (
            <p className="font-inter text-[12.5px] leading-[1.55] text-virgilio-text whitespace-pre-wrap">
              {draft}
            </p>
          ) : (
            <p className="font-inter text-[11.5px] text-text-secondary">
              Pick a tone (or skip), add an optional instruction, then generate a draft you can edit before sending.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-3">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            loading={loading}
            onClick={run}
          >
            {draft ? 'Regenerate' : 'Generate'}
          </Button>
          <Button
            type="button"
            variant="purple"
            size="xs"
            iconRight={ArrowRight}
            disabled={!draft || loading}
            onClick={useDraft}
          >
            Use draft
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
