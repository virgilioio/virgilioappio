import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  Send,
  Lock,
  Paperclip,
  CalendarPlus,
  Smile,
  Sparkles,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSendChatMessage } from '@/hooks/chat/useSendChatMessage'
import { DraftWithGioPopover } from '@/components/chat/DraftWithGioPopover'
import { SuggestedReplies } from '@/components/chat/SuggestedReplies'
import { BookingLinkPopover, type BookingCardPayload } from '@/components/chat/BookingLinkPopover'
import { supabase } from '@/lib/supabaseClient'

interface ComposerProps {
  threadId: string
  disabled?: boolean
}

type Mode = 'reply' | 'note'

const CHANNEL_META: Record<string, { color: string; label: string }> = {
  in_app: { color: '#6F3FF5', label: 'In-app' },
  email: { color: '#2563EB', label: 'Email' },
  whatsapp: { color: '#12B886', label: 'WhatsApp' },
}

/**
 * Composer — bottom of the thread pane.
 *
 * Message ↔ Internal note segmented toggle, channel indicator, auto-growing
 * textarea, toolbar (Attach · Scheduling · Emoji · Draft with Gio), Send/Save-note
 * button, and the Draft-with-Gio popover anchored above.
 */
export function Composer({ threadId, disabled = false }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<Mode>('reply')
  const [channel, setChannel] = useState<string>('in_app')
  const [draftOpen, setDraftOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const send = useSendChatMessage()

  useEffect(() => {
    let cancelled = false
    if (!threadId) return
    void supabase
      .from('chat_threads')
      .select('channel')
      .eq('id', threadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setChannel(((data?.channel as string | undefined) ?? 'in_app'))
      })
    return () => {
      cancelled = true
    }
  }, [threadId])

  // Auto-grow textarea up to 96px.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [draft])

  const isNote = mode === 'note'
  const canSend = draft.trim().length > 0 && !send.isPending && !disabled

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || send.isPending || disabled) return
    setDraft('')
    try {
      await send.mutateAsync({ threadId, body, isInternalNote: isNote })
      requestAnimationFrame(() => textareaRef.current?.focus())
    } catch {
      setDraft(body)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const channelMeta = CHANNEL_META[channel] ?? CHANNEL_META.in_app

  return (
    <>
      {!isNote && (
        <SuggestedReplies
          threadId={threadId}
          disabled={disabled}
          hidden={draftOpen}
          onPick={(text) => {
            setDraft(text)
            requestAnimationFrame(() => textareaRef.current?.focus())
          }}
        />
      )}

      <footer
        className="relative shrink-0"
        style={{
          padding: '14px 22px 18px',
          borderTop: '1px solid #E7E8EE',
          background: isNote ? '#FEFBF0' : '#FFFFFF',
        }}
      >
        <DraftWithGioPopover
          threadId={threadId}
          open={draftOpen}
          onOpenChange={setDraftOpen}
          onInsert={(text) => {
            setDraft(text)
            requestAnimationFrame(() => textareaRef.current?.focus())
          }}
        />

        {/* Top row: mode toggle + indicator */}
        <div className="flex items-center" style={{ marginBottom: 11 }}>
          <div
            role="tablist"
            aria-label="Composer mode"
            className="inline-flex items-center"
            style={{ background: '#F6F5F1', borderRadius: 8, padding: 3, gap: 2 }}
          >
            <ModeSegment
              active={mode === 'reply'}
              onClick={() => setMode('reply')}
              icon={<Send style={{ height: 12, width: 12 }} strokeWidth={2} />}
              label="Message"
              tone="reply"
            />
            <ModeSegment
              active={mode === 'note'}
              onClick={() => setMode('note')}
              icon={<Lock style={{ height: 12, width: 12 }} strokeWidth={2} />}
              label="Internal note"
              tone="note"
            />
          </div>

          <div
            className="ml-auto flex items-center font-inter"
            style={{ gap: 6, fontSize: 11.5, color: isNote ? '#B45309' : '#5A6072' }}
          >
            {isNote ? (
              <>
                <EyeOff style={{ height: 12, width: 12, color: '#B45309' }} strokeWidth={2} />
                Not sent to candidate
              </>
            ) : (
              <>
                <span
                  aria-hidden
                  style={{
                    height: 6,
                    width: 6,
                    borderRadius: 999,
                    background: channelMeta.color,
                    display: 'inline-block',
                  }}
                />
                Sending via {channelMeta.label}
              </>
            )}
          </div>
        </div>

        {/* Input box */}
        <div
          style={{
            border: `1px solid ${isNote ? '#FDE9B8' : '#E7E8EE'}`,
            borderRadius: 12,
            padding: '10px 14px',
            background: '#FFFFFF',
          }}
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isNote
                ? "Write a note for your team — the candidate won't see this…"
                : 'Write a message…'
            }
            rows={1}
            disabled={disabled}
            aria-label={isNote ? 'Internal note' : 'Message'}
            className="w-full resize-none bg-transparent outline-none font-inter disabled:opacity-60"
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: '#1F2230',
              maxHeight: 96,
              minHeight: 20,
              border: 0,
            }}
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center" style={{ gap: 4, marginTop: 11 }}>
          <ToolbarIcon icon={Paperclip} label="Attach" />
          <ToolbarIcon icon={CalendarPlus} label="Insert scheduling link" />
          <ToolbarIcon icon={Smile} label="Emoji" />

          {!isNote && (
            <button
              type="button"
              onClick={() => setDraftOpen((o) => !o)}
              className="inline-flex items-center font-poppins transition-colors"
              style={{
                marginLeft: 2,
                gap: 6,
                height: 32,
                padding: '0 11px',
                borderRadius: 8,
                background: draftOpen ? '#E4D8FF' : '#EDE4FF',
                color: '#6F3FF5',
                fontSize: 12,
                fontWeight: 500,
                border: 0,
              }}
            >
              <Sparkles style={{ height: 14, width: 14 }} strokeWidth={2} />
              Draft with Gio
            </button>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={isNote ? 'Save note' : 'Send message'}
            className="ml-auto inline-flex items-center font-poppins transition-opacity"
            style={{
              gap: 6,
              height: 36,
              padding: '0 16px',
              borderRadius: 9,
              background: isNote ? '#B45309' : '#0d0d09',
              color: '#fffcf9',
              fontSize: 13,
              fontWeight: 600,
              border: 0,
              opacity: draft.trim().length === 0 ? 0.55 : 1,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            {isNote ? (
              <>
                <Lock style={{ height: 14, width: 14 }} strokeWidth={2} />
                {send.isPending ? 'Saving…' : 'Save note'}
              </>
            ) : (
              <>
                {send.isPending ? 'Sending…' : 'Send'}
                <Send style={{ height: 14, width: 14 }} strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </footer>
    </>
  )
}

function ToolbarIcon({
  icon: Icon,
  label,
}: {
  icon: typeof Paperclip
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center transition-colors"
      style={{ height: 32, width: 32, borderRadius: 8, color: '#5A6072', background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F5F1')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon style={{ height: 17, width: 17 }} strokeWidth={1.9} />
    </button>
  )
}

interface ModeSegmentProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  tone: 'reply' | 'note'
}

function ModeSegment({ active, onClick, icon, label, tone }: ModeSegmentProps) {
  const activeStyle =
    tone === 'note'
      ? { background: '#FEF3C7', color: '#B45309' }
      : {
          background: '#FFFFFF',
          color: '#0d0d09',
          boxShadow: '0 1px 2px rgba(15,18,34,0.06)',
        }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('inline-flex items-center font-poppins transition-colors')}
      style={{
        gap: 6,
        padding: '4px 11px',
        borderRadius: 6,
        fontSize: 11.5,
        fontWeight: 500,
        border: 0,
        ...(active
          ? activeStyle
          : { background: 'transparent', color: '#8B8F9E' }),
      }}
    >
      {icon}
      {label}
    </button>
  )
}
