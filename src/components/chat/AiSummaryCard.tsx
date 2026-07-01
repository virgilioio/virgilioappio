import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Sparkles, X, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface AiSummaryCardProps {
  threadId: string
  open: boolean
  onClose: () => void
  /** Increment to force regeneration (recruiter re-opened Summarize). */
  reloadKey?: number
}

interface SummaryState {
  bullets: string[]
  generated_at: string
}

function splitBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.\s]+/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 8)
}

/**
 * AiSummaryCard — lilac "Conversation summary" card pinned above the messages.
 * Renders each summary line as a purple-bulleted point.
 */
export function AiSummaryCard({ threadId, open, onClose, reloadKey = 0 }: AiSummaryCardProps) {
  const [state, setState] = useState<SummaryState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('chat-ai-summarize', {
          body: { threadId, force: reloadKey > 0 },
        })
        if (fnErr) throw fnErr
        const s = data as { summary?: string; generated_at?: string } | null
        if (!alive) return
        if (!s?.summary) throw new Error('No summary returned')
        setState({
          bullets: splitBullets(s.summary),
          generated_at: s.generated_at ?? new Date().toISOString(),
        })
      } catch (e: any) {
        if (!alive) return
        const msg = e?.message || 'Could not generate a summary right now.'
        setError(msg)
        toast.error(msg)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [threadId, open, reloadKey])

  if (!open) return null

  return (
    <section
      aria-label="Conversation summary"
      style={{
        background: '#F4EFFF',
        border: '1px solid #E4D8FF',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 20,
      }}
    >
      <header className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            height: 22,
            width: 22,
            borderRadius: 7,
            background: '#EDE4FF',
            color: '#6F3FF5',
          }}
        >
          <Sparkles style={{ height: 13, width: 13 }} strokeWidth={2} />
        </div>
        <span
          className="font-poppins"
          style={{ fontSize: 13, fontWeight: 600, color: '#0d0d09', letterSpacing: '-0.01em' }}
        >
          Conversation summary
        </span>
        <span
          className="ml-auto font-inter"
          style={{ fontSize: 10.5, color: '#7C3AED' }}
        >
          by Gio
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide summary"
          className="flex items-center justify-center hover:opacity-70 transition-opacity"
          style={{ color: '#8B8F9E' }}
        >
          <X style={{ height: 14, width: 14 }} strokeWidth={2} />
        </button>
      </header>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-9/12" />
        </div>
      ) : error ? (
        <div
          className="flex items-start font-inter"
          style={{ gap: 8, fontSize: 12, color: '#7A1F1F' }}
        >
          <AlertTriangle style={{ height: 14, width: 14, marginTop: 1 }} strokeWidth={2} />
          <span>{error}</span>
        </div>
      ) : state && state.bullets.length > 0 ? (
        <ul className="flex flex-col" style={{ gap: 7 }}>
          {state.bullets.map((b, i) => (
            <li key={i} className="flex items-start" style={{ gap: 10 }}>
              <span
                aria-hidden
                style={{
                  height: 5,
                  width: 5,
                  minWidth: 5,
                  marginTop: 8,
                  borderRadius: 999,
                  background: '#6F3FF5',
                }}
              />
              <span
                className="font-inter"
                style={{ fontSize: 12.5, lineHeight: 1.55, color: '#1F2230' }}
              >
                {b}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-inter" style={{ fontSize: 12, color: '#5A6072' }}>
          Nothing to summarize yet.
        </p>
      )}
    </section>
  )
}
