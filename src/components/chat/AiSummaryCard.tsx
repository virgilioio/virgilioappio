import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface AiSummaryCardProps {
  threadId: string
}

interface SummaryState {
  summary: string
  generated_at: string
  message_count: number
  cached: boolean
}

/**
 * AiSummaryCard — "Catch me up" briefing for a chat thread (Step 3.3).
 *
 * On mount, loads the persisted summary from chat_threads.context_summary (if
 * any). The Summarize button calls the chat-ai-summarize edge function which
 * regenerates and re-persists.
 */
export function AiSummaryCard({ threadId }: AiSummaryCardProps) {
  const [state, setState] = useState<SummaryState | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load any persisted summary (RLS-gated read).
  useEffect(() => {
    let alive = true
    setInitialLoading(true)
    setState(null)
    setError(null)
    supabase
      .from('chat_threads')
      .select('context_summary')
      .eq('id', threadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const raw = (data?.context_summary ?? null) as
          | { text?: string; generated_at?: string; message_count?: number }
          | null
        if (raw && typeof raw.text === 'string' && raw.text.trim()) {
          setState({
            summary: raw.text,
            generated_at: raw.generated_at ?? new Date().toISOString(),
            message_count: raw.message_count ?? 0,
            cached: true,
          })
        }
        setInitialLoading(false)
      })
    return () => {
      alive = false
    }
  }, [threadId])

  const run = async (force: boolean) => {
    setRunning(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('chat-ai-summarize', {
        body: { threadId, force },
      })
      if (fnErr) throw fnErr
      const s = data as {
        summary: string
        generated_at: string
        message_count: number
        cached: boolean
      } | null
      if (!s?.summary) throw new Error('No summary returned')
      setState(s)
    } catch (e: any) {
      const msg = e?.message || 'Could not generate a summary right now.'
      setError(msg)
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section
      aria-label="Conversation summary"
      className="rounded-xl border border-virgilio-border bg-[#FAF8FF] p-4"
    >
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-[#EDE4FF] text-[#5B3FBF] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="font-poppins font-semibold text-[12.5px] tracking-[-0.01em] text-virgilio-text">
            Catch me up
          </span>
        </div>
        {state ? (
          <Button
            variant="ghost"
            size="xs"
            icon={RefreshCw}
            loading={running}
            onClick={() => run(true)}
            aria-label="Regenerate summary"
          >
            Refresh
          </Button>
        ) : (
          <Button
            variant="purple"
            size="xs"
            loading={running}
            disabled={initialLoading}
            onClick={() => run(false)}
          >
            Summarize
          </Button>
        )}
      </header>

      {initialLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-9/12" />
        </div>
      ) : state ? (
        <>
          <p className="font-inter text-[12.5px] leading-[1.55] text-virgilio-text whitespace-pre-wrap">
            {state.summary}
          </p>
          <div className="mt-2 text-[10.5px] uppercase tracking-[0.06em] text-text-secondary">
            Updated {formatDistanceToNow(new Date(state.generated_at), { addSuffix: true })}
          </div>
        </>
      ) : error ? (
        <div className="flex items-start gap-2 text-[12px] text-[#7A1F1F]">
          <AlertTriangle className="h-3.5 w-3.5 mt-[1px] shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <p className="font-inter text-[12px] text-text-secondary">
          Get a quick briefing of where this conversation stands.
        </p>
      )}
    </section>
  )
}
