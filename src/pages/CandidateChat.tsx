// Phase 2.4 — Public candidate chat surface at /c/chat/:token
//
// Calls `chat-token-verify` to resolve the magic-link token into thread
// context, then renders an AI Elements–based chat UI. Message send/fetch
// is wired in Phase 2.5 (chat-candidate-send / chat-candidate-fetch).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, MessageCircle, AlertCircle, Hand } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { GioLogomark } from '@/components/icons/GioLogomark'
import { Button } from '@/components/ui/button'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { Shimmer } from '@/components/ai-elements/shimmer'
import type { ChatStatus } from 'ai'

type VerifyResponse = {
  threadId: string
  tenantId: string
  candidateId: string
  jobId: string
  mode: 'ai' | 'recruiter'
  paused: boolean
  expiresAt: string
  candidate: { firstName: string; displayName: string }
  job: { title: string | null; companyName: string | null }
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; reason: 'not_found' | 'disabled' | 'rate_limited' | 'unknown' }
  | { kind: 'paused'; ctx: VerifyResponse }
  | { kind: 'ready'; ctx: VerifyResponse }

export default function CandidateChat() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<ChatStatus>('ready')
  const submittedAt = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setState({ kind: 'error', reason: 'not_found' })
      return
    }
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('chat-token-verify', {
          body: { token },
        })
        if (cancelled) return
        if (error) {
          // Edge function returns 403 chat_disabled, 404 not_found, 429 rate_limited
          const ctx = (error as { context?: Response }).context
          if (ctx?.status === 403) return setState({ kind: 'error', reason: 'disabled' })
          if (ctx?.status === 429) return setState({ kind: 'error', reason: 'rate_limited' })
          return setState({ kind: 'error', reason: 'not_found' })
        }
        const verified = data as VerifyResponse
        if (verified.paused) return setState({ kind: 'paused', ctx: verified })
        setState({ kind: 'ready', ctx: verified })
      } catch (e) {
        console.error('[CandidateChat] verify failed', e)
        if (!cancelled) setState({ kind: 'error', reason: 'unknown' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const ctx = state.kind === 'ready' || state.kind === 'paused' ? state.ctx : null
  const headerTitle = useMemo(() => {
    if (!ctx) return 'Chat'
    if (ctx.job.title && ctx.job.companyName) return `${ctx.job.companyName} · ${ctx.job.title}`
    return ctx.job.companyName ?? ctx.job.title ?? 'Chat'
  }, [ctx])

  // Initial + polling fetch once the token is verified.
  useEffect(() => {
    if (state.kind !== 'ready' || !token) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('chat-candidate-fetch', {
          body: { token },
        })
        if (!cancelled && !error && data?.messages) {
          const mapped: ChatMessage[] = (data.messages as Array<{
            id: string
            direction: 'in' | 'out'
            body: string | null
            created_at: string
          }>).map((m) => ({
            id: m.id,
            role: m.direction === 'in' ? 'user' : 'assistant',
            text: m.body ?? '',
            createdAt: new Date(m.created_at).getTime(),
          }))
          setMessages((prev) => {
            // Preserve any optimistic messages not yet returned by the server.
            const serverIds = new Set(mapped.map((m) => m.id))
            const pending = prev.filter((m) => m.id.startsWith('optimistic-') && !serverIds.has(m.id))
            return [...mapped, ...pending]
          })
        }
      } catch (e) {
        console.warn('[CandidateChat] fetch failed', e)
      }
      if (!cancelled) timer = setTimeout(tick, 5_000)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [state.kind, token])

  async function handleSubmit(message: { text?: string; files?: unknown[] }) {
    const text = (message?.text ?? input).trim()
    if (!text || status !== 'ready' || state.kind !== 'ready' || !token) return
    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const msg: ChatMessage = {
      id: optimisticId,
      role: 'user',
      text,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, msg])
    setInput('')
    setStatus('submitted')
    submittedAt.current = Date.now()
    try {
      const { data, error } = await supabase.functions.invoke('chat-candidate-send', {
        body: { token, body: text },
      })
      if (error) throw error
      const saved = (data as { message?: { id: string; created_at: string } }).message
      if (saved) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, id: saved.id, createdAt: new Date(saved.created_at).getTime() }
              : m,
          ),
        )
      }
    } catch (e) {
      console.error('[CandidateChat] send failed', e)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(text)
    } finally {
      setStatus('ready')
    }
  }


  // ---- Render -------------------------------------------------------------

  if (state.kind === 'loading') {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Shell>
    )
  }

  if (state.kind === 'error') {
    const copy =
      state.reason === 'disabled'
        ? {
            title: 'Chat is unavailable',
            body: 'The hiring team has turned off candidate chat for this role.',
          }
        : state.reason === 'rate_limited'
          ? {
              title: 'Too many attempts',
              body: 'Please wait a few minutes before trying this link again.',
            }
          : {
              title: 'This chat link isn’t valid',
              body: 'The link may have expired or been revoked. Reach out to the recruiter to receive a fresh link.',
            }
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <h1 className="font-poppins text-lg font-semibold tracking-tight">{copy.title}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{copy.body}</p>
        </div>
      </Shell>
    )
  }

  if (state.kind === 'paused') {
    return (
      <Shell title={headerTitle}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
          <h1 className="font-poppins text-lg font-semibold tracking-tight">Chat is paused</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {state.ctx.job.companyName ?? 'The team'} has temporarily paused candidate chat.
            You’ll be able to reply here once it’s resumed.
          </p>
        </div>
      </Shell>
    )
  }

  const isStreaming = status === 'submitted' || status === 'streaming'

  return (
    <Shell title={headerTitle}>
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageCircle className="h-6 w-6" />}
              title={`Hi ${state.ctx.candidate.firstName || 'there'} 👋`}
              description={
                state.ctx.mode === 'ai'
                  ? 'Ask anything about the role, process, or next steps. A recruiter is one click away.'
                  : 'Send a message and the recruiter will get back to you here.'
              }
            />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </MessageContent>
              </Message>
            ))
          )}
          {isStreaming && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-background">
        <div className="mx-auto w-full max-w-2xl space-y-2 p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                state.ctx.mode === 'ai'
                  ? 'Ask about the role, process, or anything else…'
                  : 'Write a message to the recruiter…'
              }
              disabled={isStreaming}
            />
            <PromptInputFooter className="justify-between">
              {state.ctx.mode === 'ai' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    // Phase 2.6 will toggle thread.status = 'awaiting_human'.
                    console.info('[CandidateChat] talk to a human — wired in Phase 2.6')
                  }}
                >
                  <Hand className="h-3.5 w-3.5" />
                  Talk to a human
                </Button>
              ) : (
                <span />
              )}
              <PromptInputSubmit status={status} disabled={!input.trim() || isStreaming} />
            </PromptInputFooter>
          </PromptInput>
          <p className="text-center text-[10.5px] text-muted-foreground">
            Secured by Gio · This conversation is private to you and the hiring team.
          </p>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <Helmet>
        <title>{title ? `${title} · Chat` : 'Candidate chat'}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3 text-foreground">
          <GioLogomark height={20} />
          {title && (
            <>
              <span className="h-4 w-px bg-border" />
              <span className="font-poppins text-[13px] font-medium tracking-tight">{title}</span>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  )
}
