import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Send, StickyNote, MessageSquare, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSendChatMessage } from '@/hooks/chat/useSendChatMessage'
import { DraftWithGioPopover } from '@/components/chat/DraftWithGioPopover'
import { SuggestedReplies } from '@/components/chat/SuggestedReplies'
import { supabase } from '@/lib/supabaseClient'

interface ComposerProps {
  threadId: string
  disabled?: boolean
}

type Mode = 'reply' | 'note'

/**
 * Composer — Step 1.7
 *
 * Real message composer for the thread pane. Supports two modes:
 *  - reply: outbound message to the candidate
 *  - note:  internal note visible only to the team
 *
 * Keyboard:
 *  - Enter        → send
 *  - Shift+Enter  → newline
 *  - ⌘/Ctrl + .   → toggle mode
 */
export function Composer({ threadId, disabled = false }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<Mode>('reply')
  const [channel, setChannel] = useState<string | null>(null)
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
        if (!cancelled) setChannel((data?.channel as string | undefined) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [threadId])

  const isNote = mode === 'note'
  const isEmail = !isNote && channel === 'email'
  const canSend = draft.trim().length > 0 && !send.isPending && !disabled

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || send.isPending || disabled) return
    setDraft('')
    try {
      await send.mutateAsync({ threadId, body, isInternalNote: isNote })
      requestAnimationFrame(() => textareaRef.current?.focus())
    } catch {
      // Restore draft on failure so the user doesn't lose their message.
      setDraft(body)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '.') {
      e.preventDefault()
      setMode((m) => (m === 'reply' ? 'note' : 'reply'))
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <footer className="border-t border-virgilio-border p-3 bg-surface-primary">
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Composer mode"
        className="flex items-center gap-1 px-1 pb-2"
      >
        <ModeTab
          active={mode === 'reply'}
          onClick={() => setMode('reply')}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Reply"
        />
        <ModeTab
          active={mode === 'note'}
          onClick={() => setMode('note')}
          icon={<StickyNote className="h-3.5 w-3.5" />}
          label="Internal note"
          tone="note"
        />
        {!isNote && (
          <div className="ml-auto">
            <DraftWithGioPopover
              threadId={threadId}
              disabled={disabled}
              onUseDraft={(text) => {
                setDraft(text)
                requestAnimationFrame(() => {
                  const el = textareaRef.current
                  if (el) {
                    el.focus()
                    el.setSelectionRange(text.length, text.length)
                  }
                })
              }}
            />
          </div>
        )}
      </div>

      {!isNote && (
        <SuggestedReplies
          threadId={threadId}
          disabled={disabled}
          onPick={(text) => {
            setDraft(text)
            requestAnimationFrame(() => {
              const el = textareaRef.current
              if (el) {
                el.focus()
                el.setSelectionRange(text.length, text.length)
              }
            })
          }}
        />
      )}



      <div
        className={cn(
          'rounded-lg border transition-colors',
          'focus-within:ring-2 focus-within:ring-virgilio-purple/30',
          isNote
            ? 'border-[#F4E4A4] bg-[#FFFBEB]'
            : 'border-virgilio-border bg-surface-primary',
        )}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isNote
              ? 'Add an internal note — only your team can see this.'
              : 'Write a message to the candidate…'
          }
          rows={3}
          disabled={disabled}
          aria-label={isNote ? 'Internal note' : 'Reply to candidate'}
          className={cn(
            'w-full resize-none bg-transparent px-3 py-2.5 outline-none',
            'text-[13.5px] leading-[1.5] font-inter text-virgilio-text',
            'placeholder:text-text-secondary',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-current/10">
          <span className="text-[10.5px] text-text-secondary font-inter px-1">
            <kbd className="px-1 py-0.5 rounded border border-virgilio-border bg-surface-secondary font-mono text-[10px]">
              Enter
            </kbd>{' '}
            to send ·{' '}
            <kbd className="px-1 py-0.5 rounded border border-virgilio-border bg-surface-secondary font-mono text-[10px]">
              Shift+Enter
            </kbd>{' '}
            for newline
          </span>
          <div className="flex items-center gap-2">
            {isEmail && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-[#EEF1FF] px-1.5 py-0.5 text-[10.5px] font-poppins font-medium text-[#3F4FBF]"
                title="This reply will be delivered by email"
              >
                <Mail className="h-3 w-3" /> via email
              </span>
            )}
            <Button
              size="sm"
              variant={isNote ? 'secondary' : undefined}
              onClick={handleSend}
              disabled={!canSend}
              icon={Send}
            >
              {send.isPending
                ? 'Sending…'
                : isNote
                  ? 'Add note'
                  : isEmail
                    ? 'Send email'
                    : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}

interface ModeTabProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  tone?: 'reply' | 'note'
}

function ModeTab({ active, onClick, icon, label, tone = 'reply' }: ModeTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md transition-colors',
        'font-poppins font-medium text-[11.5px] tracking-[-0.005em]',
        active
          ? tone === 'note'
            ? 'bg-[#FFF4CC] text-[#7A5A00]'
            : 'bg-[#EDE4FF] text-[#5B3FBF]'
          : 'text-text-secondary hover:bg-[#F1F0EC]',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
