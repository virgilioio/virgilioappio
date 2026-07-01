import { useEffect, useState } from 'react'
import { Sparkles, Wand2, X, CornerDownLeft, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface DraftWithGioPopoverProps {
  threadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (text: string) => void
}

/**
 * DraftWithGioPopover — anchored above the composer.
 *
 * Layout is absolute-positioned by the Composer parent; this component just
 * renders the popover shell + interactions.
 */
export function DraftWithGioPopover({
  threadId,
  open,
  onOpenChange,
  onInsert,
}: DraftWithGioPopoverProps) {
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setLoading(false)
    }
  }, [open])

  const generate = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai-draft', {
        body: { threadId, instruction: instruction.trim() || undefined },
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

  const insert = () => {
    if (!draft) return
    onInsert(draft)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Draft with Gio"
      style={{
        position: 'absolute',
        left: 22,
        right: 22,
        bottom: '100%',
        marginBottom: 10,
        background: '#FFFFFF',
        border: '1px solid #E4D8FF',
        borderRadius: 14,
        boxShadow: '0 12px 32px rgba(15,18,34,0.14)',
        padding: 16,
        zIndex: 30,
      }}
    >
      <header className="flex items-center" style={{ gap: 10, marginBottom: 12 }}>
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
          Draft with Gio
        </span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="ml-auto flex items-center justify-center hover:opacity-70"
          style={{ color: '#8B8F9E' }}
        >
          <X style={{ height: 14, width: 14 }} strokeWidth={2} />
        </button>
      </header>

      {/* Prompt field */}
      <div
        className="flex items-center"
        style={{
          background: '#F6F5F1',
          borderRadius: 10,
          padding: '9px 12px',
          gap: 9,
          marginBottom: 12,
        }}
      >
        <Wand2 style={{ height: 14, width: 14, color: '#6F3FF5' }} strokeWidth={2} />
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ask for availability next week for a panel interview…"
          className="flex-1 bg-transparent outline-none font-inter"
          style={{ fontSize: 12.5, color: '#1F2230' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void generate()
            }
          }}
        />
      </div>

      {/* Suggested draft */}
      <div
        style={{
          background: '#F4EFFF',
          border: '1px solid #E4D8FF',
          borderRadius: 12,
          padding: '12px 14px',
          minHeight: 90,
        }}
      >
        <div
          className="font-inter uppercase"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#6F3FF5',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          Suggested draft
        </div>
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-8/12" />
          </div>
        ) : draft ? (
          <p
            className="font-inter whitespace-pre-wrap"
            style={{ fontSize: 12.5, lineHeight: 1.55, color: '#1F2230', margin: 0 }}
          >
            {draft}
          </p>
        ) : (
          <p
            className="font-inter"
            style={{ fontSize: 12, color: '#5A6072', margin: 0 }}
          >
            Type an instruction above and Gio will draft a reply grounded in this conversation.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end" style={{ gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center font-poppins transition-colors disabled:opacity-60"
          style={{
            gap: 6,
            height: 32,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid #E7E8EE',
            background: '#FFFFFF',
            color: '#1F2230',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <RefreshCw style={{ height: 13, width: 13 }} strokeWidth={2} />
          {draft ? 'Regenerate' : 'Generate'}
        </button>
        <button
          type="button"
          onClick={insert}
          disabled={!draft || loading}
          className="inline-flex items-center font-poppins transition-colors disabled:opacity-55"
          style={{
            gap: 6,
            height: 32,
            padding: '0 12px',
            borderRadius: 8,
            background: '#6F3FF5',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 600,
            border: 0,
          }}
        >
          <CornerDownLeft style={{ height: 13, width: 13 }} strokeWidth={2} />
          Insert draft
        </button>
      </div>
    </div>
  )
}
