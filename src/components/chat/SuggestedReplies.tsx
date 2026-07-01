import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface SuggestedRepliesProps {
  threadId: string
  disabled?: boolean
  hidden?: boolean
  onPick: (text: string) => void
}

/**
 * SuggestedReplies — "Gio suggests" chip row rendered above the composer.
 * Auto-fetches 2–4 short reply chips on thread change; clicking a chip inserts
 * its text into the composer.
 */
export function SuggestedReplies({
  threadId,
  disabled,
  hidden,
  onPick,
}: SuggestedRepliesProps) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null)

  useEffect(() => {
    if (!threadId || hidden) return
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('chat-ai-suggest-replies', {
          body: { threadId },
        })
        if (error) throw error
        if (!alive) return
        const list = ((data as { suggestions?: string[] })?.suggestions ?? [])
          .filter((s) => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 4)
        setSuggestions(list)
      } catch {
        if (alive) setSuggestions(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [threadId, hidden])

  if (hidden || !suggestions || suggestions.length === 0) return null

  return (
    <div
      className="flex items-center flex-wrap"
      style={{ padding: '0 22px 10px', gap: 8 }}
    >
      <span
        className="inline-flex items-center font-inter"
        style={{ gap: 5, fontSize: 11, fontWeight: 500, color: '#6F3FF5' }}
      >
        <Sparkles style={{ height: 12, width: 12 }} strokeWidth={2} />
        Gio suggests
      </span>
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s)}
          disabled={disabled}
          className="font-inter transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: '#FFFFFF',
            border: '1px solid #E4D8FF',
            color: '#5B21B6',
            fontWeight: 500,
            fontSize: 12,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F4EFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
