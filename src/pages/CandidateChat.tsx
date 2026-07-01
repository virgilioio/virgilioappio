// Public candidate-facing chat surface at /c/chat/:token
//
// Warm, human 1:1 experience with the recruiter. Desktop = centered white
// panel on warm canvas. Mobile = full-bleed app-like layout with simulated
// status bar + home indicator.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  AlertCircle,
  ArrowUp,
  BatteryFull,
  Briefcase,
  ChevronLeft,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  Paperclip,
  Signal,
  Wifi,
  X,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { GioWordmark } from '@/components/icons/GioWordmark'

// ---------- Types ----------------------------------------------------------

type RecruiterInfo = {
  firstName: string
  lastName: string
  displayName: string
  title: string | null
  avatarUrl: string | null
  initials: string
}

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
  recruiter: RecruiterInfo | null
  suggestedQuestions: string[]
}

type Attachment = {
  path: string
  name: string
  mime: string
  size: number
  url?: string
}

type ChatMessage = {
  id: string
  role: 'candidate' | 'recruiter'
  text: string
  createdAt: number
  attachments?: Attachment[]
  status?: 'sending' | 'sent'
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; reason: 'not_found' | 'disabled' | 'rate_limited' | 'unknown' }
  | { kind: 'paused'; ctx: VerifyResponse }
  | { kind: 'ready'; ctx: VerifyResponse }

// ---------- Constants ------------------------------------------------------

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT_TYPES = [
  'image/*',
  'application/pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  'text/plain', '.csv',
].join(',')

// Deterministic warm hue for recruiter avatar (soft brand-friendly palette).
function recruiterColor(seed: string) {
  const palette = [
    { bg: '#EDE4FF', fg: '#6F3FF5' }, // lilac / purple
    { bg: '#E6F4EA', fg: '#12855A' },
    { bg: '#FFEBE0', fg: '#C25200' },
    { bg: '#E0F0FF', fg: '#0056B3' },
    { bg: '#FFE4EE', fg: '#B03060' },
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

function candidateInitial(name: string) {
  return (name.trim()[0] ?? 'U').toUpperCase()
}

function useIsMobile() {
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false,
  )
  useEffect(() => {
    const mm = window.matchMedia('(max-width: 640px)')
    const on = () => setM(mm.matches)
    mm.addEventListener('change', on)
    return () => mm.removeEventListener('change', on)
  }, [])
  return m
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------- Page -----------------------------------------------------------

export default function CandidateChat() {
  const { token } = useParams<{ token: string }>()
  const isMobile = useIsMobile()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingFile, setPendingFile] = useState<{
    file: File
    progress: number
    error?: string
    attachment?: Attachment
  } | null>(null)
  const [sending, setSending] = useState(false)

  // ----- Verify token ------------------------------------------------------
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

  // ----- Poll messages -----------------------------------------------------
  useEffect(() => {
    if (state.kind !== 'ready' || !token) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const INTERVAL = 4000

    const fetchOnce = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('chat-candidate-fetch', {
          body: { token },
        })
        if (cancelled || error || !data?.messages) return
        const mapped: ChatMessage[] = (data.messages as Array<{
          id: string
          direction: 'in' | 'out'
          body: string | null
          parts: unknown
          created_at: string
        }>).map((m) => {
          const parts = (m.parts ?? null) as { attachments?: Attachment[] } | null
          return {
            id: m.id,
            role: m.direction === 'in' ? 'candidate' : 'recruiter',
            text: m.body ?? '',
            createdAt: new Date(m.created_at).getTime(),
            attachments: parts?.attachments ?? undefined,
            status: 'sent',
          }
        })
        setMessages((prev) => {
          const serverIds = new Set(mapped.map((m) => m.id))
          const pending = prev.filter((m) => m.id.startsWith('optimistic-') && !serverIds.has(m.id))
          return [...mapped, ...pending]
        })
      } catch (e) {
        console.warn('[CandidateChat] fetch failed', e)
      }
    }

    const schedule = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      timer = setTimeout(async () => {
        await fetchOnce()
        schedule()
      }, INTERVAL)
    }

    const wake = () => {
      if (document.visibilityState !== 'visible') return
      void fetchOnce()
      if (timer) clearTimeout(timer)
      schedule()
    }

    void fetchOnce().then(schedule)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [state.kind, token])

  // ----- Actions -----------------------------------------------------------
  const pickFile = useCallback(async (file: File) => {
    if (!token) return
    if (file.size > MAX_FILE_BYTES) {
      setPendingFile({ file, progress: 0, error: 'File is larger than 10 MB.' })
      return
    }
    setPendingFile({ file, progress: 0 })
    try {
      const { data, error } = await supabase.functions.invoke('chat-candidate-upload', {
        body: { token, filename: file.name, mime: file.type || 'application/octet-stream', size: file.size },
      })
      if (error || !data) throw error ?? new Error('upload_failed')
      const { path, bucket, token: uploadToken, readUrl } = data as {
        path: string; bucket: string; token: string; readUrl: string | null
      }
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type })
      if (upErr) throw upErr
      const attachment: Attachment = {
        path,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        url: readUrl ?? undefined,
      }
      setPendingFile({ file, progress: 100, attachment })
    } catch (e) {
      console.error('[CandidateChat] upload failed', e)
      setPendingFile({ file, progress: 0, error: 'Upload failed. Please try again.' })
    }
  }, [token])

  const doSend = useCallback(async () => {
    if (state.kind !== 'ready' || !token) return
    const body = input.trim()
    const attachment = pendingFile?.attachment
    if (!body && !attachment) return
    if (pendingFile && !attachment) return // still uploading / errored
    setSending(true)
    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimistic: ChatMessage = {
      id: optimisticId,
      role: 'candidate',
      text: body,
      createdAt: Date.now(),
      attachments: attachment ? [attachment] : undefined,
      status: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setPendingFile(null)
    try {
      const { data, error } = await supabase.functions.invoke('chat-candidate-send', {
        body: { token, body, attachment },
      })
      if (error) throw error
      const saved = (data as { message?: { id: string; created_at: string } }).message
      if (saved) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, id: saved.id, status: 'sent', createdAt: new Date(saved.created_at).getTime() }
              : m,
          ),
        )
      }
    } catch (e) {
      console.error('[CandidateChat] send failed', e)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(body)
      setPendingFile(attachment ? { file: new File([], attachment.name), progress: 100, attachment } : null)
    } finally {
      setSending(false)
    }
  }, [input, pendingFile, state.kind, token])

  const useSuggestion = useCallback((text: string) => setInput(text), [])

  // ----- Loading / error / paused states -----------------------------------
  if (state.kind === 'loading') {
    return (
      <Frame isMobile={isMobile}>
        <div className="flex flex-1 items-center justify-center text-[#5A6072]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Frame>
    )
  }

  if (state.kind === 'error') {
    const copy = state.reason === 'disabled'
      ? { t: 'Chat is unavailable', b: 'The hiring team has turned off chat for this role.' }
      : state.reason === 'rate_limited'
        ? { t: 'Too many attempts', b: 'Please wait a few minutes before trying this link again.' }
        : { t: "This chat link isn't valid", b: 'The link may have expired or been revoked. Reach out to the recruiter for a fresh one.' }
    return (
      <Frame isMobile={isMobile}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-[#8B8F9E]" />
          <h1 className="font-poppins text-[17px] font-semibold tracking-[-0.015em] text-[#0d0d09]">{copy.t}</h1>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-[#5A6072]">{copy.b}</p>
        </div>
      </Frame>
    )
  }

  if (state.kind === 'paused') {
    return (
      <Frame isMobile={isMobile}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <MessageCircle className="h-8 w-8 text-[#8B8F9E]" />
          <h1 className="font-poppins text-[17px] font-semibold tracking-[-0.015em] text-[#0d0d09]">Chat is paused</h1>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-[#5A6072]">
            {state.ctx.job.companyName ?? 'The team'} has temporarily paused chat. You'll be able to
            reply here once it's resumed.
          </p>
        </div>
      </Frame>
    )
  }

  // ----- Ready -------------------------------------------------------------
  const { ctx } = state

  return (
    <Frame isMobile={isMobile} candidateName={ctx.candidate.firstName || ctx.candidate.displayName}>
      <Helmet>
        <title>{`Chat with ${ctx.job.companyName ?? 'the hiring team'}`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <Conversation
        isMobile={isMobile}
        ctx={ctx}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={doSend}
        onPickFile={pickFile}
        pendingFile={pendingFile}
        clearPending={() => setPendingFile(null)}
        onSuggestion={useSuggestion}
        sending={sending}
      />
    </Frame>
  )
}

// ---------- Frame ----------------------------------------------------------

function Frame({
  children,
  isMobile,
  candidateName,
}: {
  children: React.ReactNode
  isMobile: boolean
  candidateName?: string
}) {
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col bg-white">
        <MobileStatusBar />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        <div className="flex justify-center py-2">
          <span
            className="block h-[5px] w-[128px] rounded-full"
            style={{ backgroundColor: 'rgba(13,13,9,0.85)' }}
          />
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-[100dvh] flex-col" style={{ backgroundColor: '#F6F5F1' }}>
      <DesktopBrandBar candidateName={candidateName} />
      <div className="flex flex-1 items-stretch justify-center overflow-hidden" style={{ padding: '26px 24px' }}>
        <div
          className="flex w-full max-w-full flex-col overflow-hidden bg-white"
          style={{
            width: 720,
            borderRadius: 20,
            border: '1px solid #E7E8EE',
            boxShadow: '0 12px 40px rgba(15,18,34,0.08)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function DesktopBrandBar({ candidateName }: { candidateName?: string }) {
  const initial = candidateInitial(candidateName ?? 'U')
  return (
    <header
      className="flex items-center bg-white"
      style={{ borderBottom: '1px solid #E7E8EE', padding: '16px 26px' }}
    >
      <GioWordmark height={96} />
      <span className="mx-4 h-6 w-px" style={{ backgroundColor: '#E7E8EE' }} />
      <ChatGlyph size={18} />
      <span className="ml-2 font-inter text-[13px]" style={{ color: '#5A6072' }}>
        Chat with the hiring team
      </span>
      {candidateName && (
        <div className="ml-auto flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center rounded-full font-poppins"
            style={{
              width: 26, height: 26, backgroundColor: '#EDE4FF', color: '#6F3FF5',
              fontWeight: 600, fontSize: 11.5,
            }}
          >
            {initial}
          </span>
          <span className="font-inter text-[12.5px]" style={{ color: '#5A6072' }}>
            {candidateName}
          </span>
        </div>
      )}
    </header>
  )
}

function MobileStatusBar() {
  return (
    <div
      className="flex items-center justify-between bg-white px-5"
      style={{ height: 44 }}
    >
      <span className="font-poppins text-[13px] font-semibold text-[#0d0d09]">9:41</span>
      <div className="flex items-center gap-1.5 text-[#0d0d09]">
        <Signal size={15} strokeWidth={2.2} />
        <Wifi size={15} strokeWidth={2.2} />
        <BatteryFull size={16} strokeWidth={2.2} />
      </div>
    </div>
  )
}

function ChatGlyph({ size = 16 }: { size?: number }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-[6px]"
        style={{ backgroundColor: '#0d0d09' }}
      />
      <span
        className="absolute"
        style={{
          right: -2, bottom: -1, width: size * 0.42, height: size * 0.42,
          backgroundColor: '#6F3FF5',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
          borderRadius: '2px',
        }}
      />
    </span>
  )
}

// ---------- Conversation -----------------------------------------------

function Conversation({
  isMobile, ctx, messages, input, setInput, onSend, onPickFile, pendingFile, clearPending, onSuggestion, sending,
}: {
  isMobile: boolean
  ctx: VerifyResponse
  messages: ChatMessage[]
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onPickFile: (f: File) => void
  pendingFile: { file: File; progress: number; error?: string; attachment?: Attachment } | null
  clearPending: () => void
  onSuggestion: (t: string) => void
  sending: boolean
}) {
  const recruiter = ctx.recruiter
  const rColor = useMemo(() => recruiterColor(recruiter?.displayName ?? 'Recruiter'), [recruiter?.displayName])

  // Auto-scroll to bottom on new message
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center bg-white"
        style={{
          borderBottom: '1px solid #E7E8EE',
          padding: isMobile ? '12px 16px' : '16px 22px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {isMobile && (
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Back"
            className="flex items-center justify-center"
            style={{ width: 24, height: 24, color: '#0d0d09' }}
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <RecruiterAvatar
          size={isMobile ? 38 : 42}
          initials={recruiter?.initials ?? 'R'}
          color={rColor}
          avatarUrl={recruiter?.avatarUrl ?? null}
          presence
        />

        <div className="min-w-0 flex-1">
          <div
            className="truncate font-poppins"
            style={{
              fontSize: isMobile ? 15 : 15.5,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: '#0d0d09',
            }}
          >
            {recruiter?.displayName ?? 'Your recruiter'}
          </div>
          <div className="truncate font-inter" style={{ fontSize: 12, color: '#5A6072' }}>
            {[recruiter?.title, ctx.job.companyName].filter(Boolean).join(' · ') || 'Hiring team'}
          </div>
        </div>

        <div
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full font-inter"
          style={{
            backgroundColor: '#F6F5F1',
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 500,
            color: '#5A6072',
          }}
        >
          <Lock size={12} />
          {isMobile ? 'Private' : 'Private & secure'}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-auto"
        style={{
          backgroundColor: '#F6F5F1',
          padding: isMobile ? '18px 14px 8px' : '24px 22px 8px',
        }}
      >
        {/* Job context chip */}
        <div className="mb-[18px] flex justify-center">
          <div
            className="flex items-center gap-2.5 bg-white"
            style={{
              border: '1px solid #E7E8EE',
              borderRadius: 12,
              padding: '9px 14px',
              boxShadow: '0 2px 6px rgba(15,18,34,0.04)',
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#EDE4FF' }}
            >
              <Briefcase size={14} color="#6F3FF5" />
            </span>
            <div className="min-w-0">
              <div className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', lineHeight: 1.2 }}>
                You're chatting about
              </div>
              <div
                className="truncate font-poppins"
                style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09', lineHeight: 1.3 }}
              >
                {ctx.job.title ?? 'Open role'}
              </div>
            </div>
          </div>
        </div>

        {/* Today separator */}
        <div className="mb-[16px] flex justify-center">
          <span
            className="bg-white font-inter"
            style={{
              border: '1px solid #E7E8EE',
              borderRadius: 999,
              padding: '3px 12px',
              fontSize: 10.5,
              fontWeight: 500,
              color: '#8B8F9E',
            }}
          >
            Today
          </span>
        </div>

        {/* Bubbles */}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const isRecruiter = m.role === 'recruiter'
          const showAvatar =
            isRecruiter && (!prev || prev.role !== 'recruiter')
          return (
            <MessageRow
              key={m.id}
              message={m}
              isMobile={isMobile}
              showAvatar={showAvatar}
              recruiterColor={rColor}
              recruiterInitials={recruiter?.initials ?? 'R'}
              recruiterAvatarUrl={recruiter?.avatarUrl ?? null}
            />
          )
        })}

        {messages.length === 0 && (
          <div className="mt-4 px-2 text-center font-inter" style={{ color: '#8B8F9E', fontSize: 13 }}>
            Say hi{ctx.candidate.firstName ? `, ${ctx.candidate.firstName}` : ''} — {recruiter?.firstName || 'the team'} will get back to you here.
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer
        isMobile={isMobile}
        suggestions={ctx.suggestedQuestions}
        hasStarted={messages.some((m) => m.role === 'candidate') || input.length > 0}
        input={input}
        setInput={setInput}
        onSend={onSend}
        onPickFile={onPickFile}
        pendingFile={pendingFile}
        clearPending={clearPending}
        onSuggestion={onSuggestion}
        sending={sending}
      />
    </>
  )
}

// ---------- Avatar ---------------------------------------------------------

function RecruiterAvatar({
  size, initials, color, avatarUrl, presence,
}: {
  size: number
  initials: string
  color: { bg: string; fg: string }
  avatarUrl: string | null
  presence?: boolean
}) {
  return (
    <span
      className="relative inline-flex flex-shrink-0 items-center justify-center overflow-visible rounded-full font-poppins"
      style={{ width: size, height: size, backgroundColor: color.bg, color: color.fg, fontWeight: 600, fontSize: size * 0.4 }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
      {presence && (
        <span
          className="absolute"
          style={{
            width: 11, height: 11, borderRadius: '50%', backgroundColor: '#12B886',
            border: '2px solid #FFFFFF', right: -1, bottom: -1,
          }}
        />
      )}
    </span>
  )
}

// ---------- MessageRow -----------------------------------------------------

function MessageRow({
  message, isMobile, showAvatar, recruiterColor, recruiterInitials, recruiterAvatarUrl,
}: {
  message: ChatMessage
  isMobile: boolean
  showAvatar: boolean
  recruiterColor: { bg: string; fg: string }
  recruiterInitials: string
  recruiterAvatarUrl: string | null
}) {
  const isRecruiter = message.role === 'recruiter'
  const bubbleMax = isMobile ? '80%' : '72%'

  return (
    <div
      className="mb-[14px] flex"
      style={{
        alignItems: 'flex-end',
        gap: 10,
        justifyContent: isRecruiter ? 'flex-start' : 'flex-end',
      }}
    >
      {isRecruiter && (
        showAvatar ? (
          <RecruiterAvatar
            size={30}
            initials={recruiterInitials}
            color={recruiterColor}
            avatarUrl={recruiterAvatarUrl}
          />
        ) : (
          <span style={{ width: 30, height: 30, flexShrink: 0 }} />
        )
      )}

      <div style={{ maxWidth: bubbleMax, minWidth: 0 }}>
        <div
          className="font-inter"
          style={{
            padding: '11px 15px',
            fontSize: isMobile ? 15 : 14.5,
            lineHeight: 1.5,
            borderRadius: 18,
            borderBottomLeftRadius: isRecruiter ? 5 : 18,
            borderBottomRightRadius: isRecruiter ? 18 : 5,
            backgroundColor: isRecruiter ? '#FFFFFF' : '#0d0d09',
            color: isRecruiter ? '#1F2230' : '#fffcf9',
            border: isRecruiter ? '1px solid #E7E8EE' : 'none',
            boxShadow: isRecruiter ? '0 1px 2px rgba(15,18,34,0.04)' : 'none',
            wordBreak: 'break-word',
          }}
        >
          {message.attachments?.map((a, i) => (
            <AttachmentBlock key={i} attachment={a} outbound={!isRecruiter} />
          ))}
          {message.text && (
            <div className="whitespace-pre-wrap" style={{ marginTop: message.attachments?.length ? 8 : 0 }}>
              {message.text}
            </div>
          )}
        </div>
        <div
          className="mt-[5px] font-inter"
          style={{
            fontSize: 10.5,
            color: '#8B8F9E',
            textAlign: isRecruiter ? 'left' : 'right',
          }}
        >
          {message.status === 'sending' ? 'Sending…' : formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  )
}

function AttachmentBlock({ attachment, outbound }: { attachment: Attachment; outbound: boolean }) {
  const isImage = attachment.mime.startsWith('image/') && attachment.url
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-[260px] w-auto rounded-[12px] object-cover"
          style={{ maxWidth: '100%' }}
        />
      </a>
    )
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-[10px]"
      style={{
        padding: '8px 10px',
        backgroundColor: outbound ? 'rgba(255,252,249,0.10)' : '#F6F5F1',
        color: outbound ? '#fffcf9' : '#1F2230',
      }}
    >
      <FileText size={18} />
      <div className="min-w-0">
        <div className="truncate font-inter" style={{ fontSize: 13, fontWeight: 500 }}>
          {attachment.name}
        </div>
        <div className="font-inter" style={{ fontSize: 11, opacity: 0.7 }}>
          {formatBytes(attachment.size)}
        </div>
      </div>
    </a>
  )
}

// ---------- Composer -------------------------------------------------------

function Composer({
  isMobile, suggestions, hasStarted, input, setInput, onSend, onPickFile, pendingFile, clearPending, onSuggestion, sending,
}: {
  isMobile: boolean
  suggestions: string[]
  hasStarted: boolean
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onPickFile: (f: File) => void
  pendingFile: { file: File; progress: number; error?: string; attachment?: Attachment } | null
  clearPending: () => void
  onSuggestion: (t: string) => void
  sending: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [input])

  const canSend = (input.trim().length > 0 || !!pendingFile?.attachment) && !sending && !(pendingFile && !pendingFile.attachment)

  const showSuggestions = !hasStarted && suggestions.length > 0

  return (
    <div
      className="bg-white"
      style={{
        borderTop: '1px solid #E7E8EE',
        padding: isMobile ? '10px 12px 12px' : '14px 20px 16px',
        flexShrink: 0,
      }}
    >
      {showSuggestions && (
        <div
          className="mb-[11px] flex gap-2"
          style={{
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            overflowX: isMobile ? 'auto' : 'visible',
            scrollbarWidth: 'none',
          }}
        >
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSuggestion(q)}
              className="flex-shrink-0 font-inter"
              style={{
                padding: '7px 13px',
                borderRadius: 999,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E8EE',
                color: '#1F2230',
                fontWeight: 500,
                fontSize: 12.5,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {pendingFile && (
        <div
          className="mb-[10px] flex items-center gap-2.5 rounded-[12px]"
          style={{ padding: '8px 10px', backgroundColor: '#F6F5F1', border: '1px solid #E7E8EE' }}
        >
          <span
            className="flex items-center justify-center rounded-[8px]"
            style={{ width: 32, height: 32, backgroundColor: '#EDE4FF', color: '#6F3FF5' }}
          >
            <FileText size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-inter" style={{ fontSize: 13, fontWeight: 500, color: '#1F2230' }}>
              {pendingFile.file.name}
            </div>
            <div className="font-inter" style={{ fontSize: 11, color: pendingFile.error ? '#C0392B' : '#8B8F9E' }}>
              {pendingFile.error
                ? pendingFile.error
                : pendingFile.attachment
                  ? `Ready · ${formatBytes(pendingFile.file.size)}`
                  : 'Uploading…'}
            </div>
          </div>
          <button
            type="button"
            onClick={clearPending}
            aria-label="Remove attachment"
            className="flex items-center justify-center rounded-full hover:bg-white"
            style={{ width: 24, height: 24, color: '#5A6072' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-end" style={{ gap: 10 }}>
        <div
          className="flex flex-1 items-end"
          style={{
            minHeight: 48,
            backgroundColor: '#F6F5F1',
            border: '1px solid #E7E8EE',
            borderRadius: 24,
            padding: '0 8px 0 16px',
          }}
        >
          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) onSend()
              }
            }}
            rows={1}
            placeholder="Ask about the role, or reply…"
            className="flex-1 resize-none bg-transparent font-inter outline-none placeholder:text-[#8B8F9E]"
            style={{
              padding: '13px 0',
              fontSize: isMobile ? 15 : 14.5,
              color: '#1F2230',
              lineHeight: 1.4,
              minHeight: 46,
              maxHeight: 140,
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
            className="mb-[7px] ml-1 flex flex-shrink-0 items-center justify-center rounded-full hover:bg-white"
            style={{ width: 34, height: 34, color: '#5A6072' }}
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_TYPES}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex flex-shrink-0 items-center justify-center rounded-full transition-opacity"
          style={{
            width: 48, height: 48,
            backgroundColor: '#0d0d09',
            color: '#fffcf9',
            opacity: canSend ? 1 : 0.35,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} />}
        </button>
      </div>

      <div className="mt-[11px] flex items-center justify-center gap-1.5 font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
        <GioWordmark height={11} />
        <span>· Private to you and the hiring team</span>
      </div>
    </div>
  )
}
