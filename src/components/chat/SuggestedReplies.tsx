import { useState } from 'react'
import { Wand2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface SuggestedRepliesProps {
  threadId: string
  disabled?: boolean
  onPick: (text: string) => void
}

/**
 * SuggestedReplies — Step 3.5
 *
 * Recruiter-only quick chips. On demand, asks `chat-ai-suggest-replies` for
 * three short reply ideas grounded in the latest transcript. Clicking a chip
 * pipes the text straight into the composer textarea for the recruiter to
 * tweak before sending.
 *
 * Kept dismissable + on-demand (not auto-fetching) so we don't burn tokens on
 * threads the recruiter never engages.
 */
export function SuggestedReplies({ threadId, disabled, onPick }: SuggestedRepliesProps) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setReason(null)
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai-suggest-replies', {
        body: { threadId },
      })
      if (error) throw error
      const payload = data as { suggestions?: string[]; reason?: string }
      setSuggestions(payload?.suggestions ?? [])
      if (payload?.reason) setReason(payload.reason)
    } catch (e: any) {
      toast.error(e?.message || 'Could not generate suggestions right now.')
      setSuggestions(null)
    } finally {
      setLoading(false)
    }
  }

  const dismiss = () => {
    setSuggestions(null)
    setReason(null)
  }

  // Idle trigger chip
  if (!loading && suggestions === null) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md transition-colors',
          'font-poppins font-medium text-[11.5px] tracking-[-0.005em]',
          'text-[#5B3FBF] hover:bg-[#EDE4FF] disabled:opacity-60 disabled:cursor-not-allowed',
        )}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Suggest replies
      </button>
    )
  }

  return (
    <div className="w-full px-1 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] font-inter uppercase tracking-[0.06em] text-text-secondary">
          Suggested replies
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            icon={RefreshCw}
            onClick={run}
            disabled={loading || disabled}
            aria-label="Regenerate suggestions"
          >
            Refresh
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={X}
            onClick={dismiss}
            aria-label="Dismiss suggestions"
          >
            Hide
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-[85%] rounded-md" />
          <Skeleton className="h-7 w-[70%] rounded-md" />
          <Skeleton className="h-7 w-[78%] rounded-md" />
        </div>
      ) : suggestions && suggestions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(s)}
              disabled={disabled}
              className={cn(
                'group text-left px-2.5 py-1.5 rounded-md border border-virgilio-border',
                'bg-surface-primary hover:bg-[#FAF8FF] hover:border-[#D9CCFF]',
                'font-inter text-[12.5px] leading-[1.4] text-virgilio-text',
                'transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11.5px] font-inter text-text-secondary px-0.5">
          {reason === 'no_candidate_message'
            ? 'Waiting on a candidate message to suggest replies.'
            : 'No suggestions available.'}
        </p>
      )}
    </div>
  )
}
