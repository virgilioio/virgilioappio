import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  Check,
  CircleX,
  Clock,
  FileText,
  Lock,
  MoreHorizontal,
  PenLine,
  ShieldCheck,
  Sparkles,
  Type,
} from 'lucide-react'

import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { LoadError } from '@/components/empty/LoadError'
import { Textarea } from '@/components/ui/textarea'
import { IconTip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { cn } from '@/lib/utils'
import { prefersReducedMotion, shakeFirstInvalid } from '@/lib/motion'
import { loadPdfFromUrl } from '@/lib/sign/pdf'
import {
  SignerError,
  sessionStore,
  signer,
  type AdoptedSignature,
  type SignerDocument,
  type SignerField,
  type SignerOpen,
} from '@/lib/sign/signer'
import { AdoptSignature } from '@/components/sign/signer/AdoptSignature'
import { DataFieldText } from '@/components/sign/DataFieldText'

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Caveat&family=Dancing+Script&family=Homemade+Apple&family=Mr+Dafoe&display=swap'

/** The signature fonts load only on this page. */
function useSignatureFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = FONTS_HREF
    document.head.appendChild(l)
  }, [])
}

function Logo({ className }: { className?: string }) {
  return <img src="/gio-sign-logo.svg" alt="Gio Sign" className={cn('h-[18px] w-auto', className)} />
}

/* ---------------------------------------------------------------- frames */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-virgilio-cream">
      <div className="flex flex-1 items-center justify-center px-4 py-8">{children}</div>
    </div>
  )
}

function Card({ children, width = 460 }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white shadow-[0_12px_40px_-12px_rgba(15,18,34,.15)]" style={{ maxWidth: width }}>
      {children}
    </div>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-poppins text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[#0d0d09] [text-wrap:pretty]">
      {children}
      <span className="text-virgilio-purple">.</span>
    </h1>
  )
}

function Secured() {
  return (
    <div className="flex items-center justify-center gap-1.5 px-6 pb-5 font-inter text-[11.5px] text-[#6B7080]">
      <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
      Secured by
      <Logo className="h-[14px]" />
      · every step is recorded
    </div>
  )
}

/** One screen for every way a link can end. */
function Terminal({ icon, tone, title, children }: { icon: React.ReactNode; tone: 'ok' | 'muted' | 'warn'; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Centered>
      <Card width={520}>
        <div className="flex flex-col gap-4 px-7 pb-6 pt-7">
          <span
            className={cn(
              'flex h-[52px] w-[52px] items-center justify-center rounded-full',
              tone === 'ok' ? 'bg-[#E3F3EA] text-[#16704A]' : tone === 'warn' ? 'bg-[#FCF1DC] text-[#7A4A06]' : 'bg-[#F1F0EC] text-[#5A6072]',
            )}
          >
            {icon}
          </span>
          <Title>{title}</Title>
          {children}
        </div>
        <Secured />
      </Card>
    </Centered>
  )
}

/* ------------------------------------------------------------------ gate */

function Gate({
  token,
  info,
  onVerified,
}: {
  token: string
  info: SignerOpen
  onVerified: (session: string) => void
}) {
  const [phase, setPhase] = useState<'consent' | 'code'>(info.consented && info.code_sent_at ? 'code' : 'consent')
  const [agree, setAgree] = useState(info.consented)
  const [disc, setDisc] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [masked, setMasked] = useState(info.recipient.email_masked)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const pages = info.documents.reduce((a, d) => a + d.pages, 0)
  const docName = info.documents[0]?.name.replace(/\.pdf$/i, '') ?? info.title

  useEffect(() => {
    if (!wait) return
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000)
    return () => clearInterval(t)
  }, [wait])
  useEffect(() => {
    if (phase === 'code') refs.current[0]?.focus()
  }, [phase])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await signer.sendCode(token)
      setMasked(r.email_masked)
      setWait(r.wait)
      setPhase('code')
    } catch (e) {
      const err = e as SignerError
      if (err.code === 'wait') {
        setWait(Number(err.details.wait) || 30)
        setPhase('code')
      } else setError(err.code === 'rate_limited' ? 'Too many codes for now. Try again in an hour.' : 'Couldn’t send the code. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const check = async (digits: string[]) => {
    const value = digits.join('')
    if (value.length < 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await signer.verify(token, value)
      sessionStore.set(token, r.session, r.expires_at)
      onVerified(r.session)
    } catch (e) {
      const err = e as SignerError
      setCode(['', '', '', '', '', ''])
      setError(
        err.code === 'code_expired'
          ? 'That code has run out. Send a new one.'
          : err.code === 'too_many_tries'
          ? 'Too many tries. Send a new code.'
          : 'That code didn’t match. Try again.',
      )
      requestAnimationFrame(() => {
        refs.current[0]?.focus()
        shakeFirstInvalid(document.querySelector('.gio-otp'))
      })
    } finally {
      setBusy(false)
    }
  }

  const put = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '')
    if (d.length > 1) {
      const a = d.slice(0, 6).split('')
      while (a.length < 6) a.push('')
      setCode(a)
      refs.current[Math.min(5, d.length)]?.focus()
      void check(a)
      return
    }
    const a = [...code]
    a[i] = d
    setCode(a)
    setError(null)
    if (d && i < 5) refs.current[i + 1]?.focus()
    void check(a)
  }

  return (
    <Centered>
      <Card>
        <div className="flex flex-col gap-3 px-6 pb-4 pt-6 sm:px-[26px]">
          <div className="flex items-center gap-2.5 font-inter text-[12.5px] text-text-secondary">
            <span aria-hidden className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#F2EBFF] font-inter text-[12px] font-semibold text-virgilio-purple">
              {(info.sender_name || '?').trim()[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 truncate">
              <span className="font-medium text-text-primary">{info.sender_name}</span> · {info.brand}
            </span>
          </div>
          {phase === 'consent' ? (
            <>
              <Title>Review and sign {docName}</Title>
              <p className="font-inter text-[13px] leading-relaxed text-text-secondary">
                {info.sender_name} sent you {info.documents.length === 1 ? 'a document' : `${info.documents.length} documents`} to sign electronically. First,
                confirm you’re happy to do this online.
              </p>
            </>
          ) : (
            <>
              <Title>Check your email</Title>
              <p className="font-inter text-[13px] leading-relaxed text-text-secondary">
                To make sure it’s you, we sent a 6-digit code to <span className="font-medium text-text-primary">{masked}</span>.
              </p>
            </>
          )}
        </div>
        {phase === 'consent' && (
          <div className="mx-6 flex items-center gap-3 rounded-xl border border-[#E7E8EE] bg-[#FAFAF7] px-3 py-2.5 sm:mx-[26px]">
            <span className="flex h-9 w-[30px] shrink-0 items-center justify-center rounded-[5px] bg-[#F1F0EC] text-text-secondary">
              <FileText className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-inter text-[13px] font-semibold text-text-primary">{info.title}</p>
              <p className="font-inter text-[11.5px] tabular-nums text-text-tertiary">
                {info.documents.length} document{info.documents.length === 1 ? '' : 's'} · {pages} page{pages === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3.5 px-6 pb-5 pt-4 sm:px-[26px]">
          {phase === 'consent' ? (
            <>
              <label className="flex cursor-pointer items-start gap-2.5 font-inter text-[13px] leading-normal text-text-primary">
                <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#0d0d09]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  I agree to use electronic records and signatures for this document.{' '}
                  <button type="button" className="font-medium text-virgilio-purple underline-offset-2 hover:underline" onClick={() => setDisc((d) => !d)}>
                    {disc ? 'Hide' : 'Read'} the disclosure
                  </button>
                </span>
              </label>
              {disc && (
                <p className="rounded-lg bg-[#F6F1FE] p-3 font-inter text-[12px] leading-relaxed text-text-secondary">
                  You can ask {info.brand} for a paper copy at any time, at no cost. You can withdraw consent before signing by declining. To open and
                  keep your documents you need a current browser and a PDF reader.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="gio-otp flex justify-center gap-2" data-bad={error ? '' : undefined} aria-label="6-digit code" role="group">
                {code.map((c, i) => (
                  <span key={i} className="contents">
                    {i === 3 && <i aria-hidden className="h-0.5 w-2.5 self-center rounded bg-[#D9D8D2]" />}
                    <input
                      ref={(el) => (refs.current[i] = el)}
                      value={c}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={6}
                      aria-label={`Digit ${i + 1}`}
                      aria-invalid={!!error}
                      disabled={busy}
                      onChange={(e) => put(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus()
                      }}
                    />
                  </span>
                ))}
              </div>
              <p className="min-h-[18px] text-center font-inter text-[12.5px]" role={error ? 'alert' : undefined}>
                {error ? (
                  <span className="text-virgilio-error">{error}</span>
                ) : wait ? (
                  <span className="tabular-nums text-text-tertiary">Resend code in {wait}s</span>
                ) : (
                  <button type="button" className="font-medium text-virgilio-purple underline-offset-2 hover:underline" onClick={() => void send()}>
                    Send a new code
                  </button>
                )}
              </p>
              {error && !wait && (
                <p className="-mt-2 text-center">
                  <button type="button" className="font-inter text-[12.5px] font-medium text-virgilio-purple underline-offset-2 hover:underline" onClick={() => void send()}>
                    Send a new code
                  </button>
                </p>
              )}
            </>
          )}
          {phase === 'consent' && error && <p className="font-inter text-[12.5px] text-virgilio-error" role="alert">{error}</p>}
        </div>
        <div className="flex flex-col gap-2.5 px-6 pb-5 sm:px-[26px]">
          {phase === 'consent' ? (
            <>
              <Button size="lg" className="h-11 w-full" iconRight={ArrowRight} disabled={!agree} loading={busy} onClick={() => void send()}>
                Continue
              </Button>
            </>
          ) : (
            <Button size="lg" className="h-11 w-full" disabled={code.join('').length < 6} loading={busy} onClick={() => void check(code)}>
              Verify and open
            </Button>
          )}
        </div>
        <Secured />
      </Card>
    </Centered>
  )
}

/* ------------------------------------------------------------- the pages */

function SignerPage({ docId, url, index, size, children }: { docId: string; url: string | null; index: number; size: { w: number; h: number }; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'idle' | 'ready' | 'error'>('idle')
  useEffect(() => {
    const el = box.current
    if (!el || !url) return
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    let done = false
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || done) return
        done = true
        io.disconnect()
        try {
          const pdf = await loadPdfFromUrl(docId, url)
          const page = await pdf.getPage(index + 1)
          const c = canvas.current
          if (!c) return
          const base = page.getViewport({ scale: 1 })
          const vp = page.getViewport({ scale: (el.clientWidth / base.width) * Math.min(2, window.devicePixelRatio || 1) })
          c.width = Math.floor(vp.width)
          c.height = Math.floor(vp.height)
          task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp }) as unknown as typeof task
          await task!.promise
          setState('ready')
        } catch (e) {
          if ((e as { name?: string })?.name !== 'RenderingCancelledException') setState('error')
        }
      },
      { rootMargin: '800px 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      task?.cancel()
    }
  }, [docId, url, index])
  return (
    <div ref={box} className="gio-signer-page w-full" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
      {state === 'idle' && <Skeleton className="absolute inset-[7%] rounded-md opacity-60" />}
      {state === 'error' && <p className="absolute inset-x-0 top-1/3 text-center font-inter text-[12.5px] text-virgilio-error">This page couldn’t be shown. Reload to try again.</p>}
      <canvas ref={canvas} data-ready={state === 'ready' || undefined} aria-hidden />
      {children}
    </div>
  )
}

type Vals = Record<string, string | boolean>

const isDone = (f: SignerField, v: Vals, adopted: AdoptedSignature | null) =>
  f.type === 'signature' || f.type === 'initials'
    ? !!adopted && v[f.id] === true
    : f.type === 'checkbox'
    ? v[f.id] === true
    : f.type === 'name' || f.type === 'text'
    ? String(v[f.id] ?? '').trim().length > 0
    : true

function SignDocument({
  token,
  session,
  doc,
  mobile,
  onFinished,
  onDecline,
  onSessionLost,
}: {
  token: string
  session: string
  doc: SignerDocument
  mobile: boolean
  onFinished: (r: { status: 'sent' | 'completed'; next: string[]; signed_at: string }) => void
  onDecline: () => void
  onSessionLost: () => void
}) {
  const mine = useMemo(() => doc.fields.filter((f) => f.owner === 'me').sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), [doc.fields])
  const [vals, setVals] = useState<Vals>(() => {
    const v: Vals = {}
    for (const f of mine) if (f.type === 'name') v[f.id] = doc.recipient.name
    return v
  })
  const [adopted, setAdopted] = useState<AdoptedSignature | null>(null)
  const [adopt, setAdopt] = useState<{ field: SignerField | null; change: boolean } | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const required = mine.filter((f) => f.required && f.type !== 'date' && f.type !== 'email')
  const done = required.filter((f) => isDone(f, vals, adopted)).length
  const all = required.length
  const cur = required.find((f) => !isDone(f, vals, adopted)) ?? null
  const prefilled = mine.filter((f) => f.type === 'name' || f.type === 'email' || f.type === 'date').length + doc.fields.filter((f) => f.owner === 'data').length

  const go = useCallback((f: SignerField | null) => {
    if (!f || !scroller.current) return
    const el = scroller.current.querySelector<HTMLElement>(`[data-fid="${f.id}"]`)
    if (!el) return
    const c = scroller.current
    const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - c.clientHeight * 0.35
    c.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    const focusable = el.matches('button,input,[tabindex]') ? el : el.querySelector<HTMLElement>('input,button')
    focusable?.focus({ preventScroll: true })
  }, [])

  const advance = (nv: Vals, a: AdoptedSignature | null) =>
    setTimeout(() => go(required.find((f) => !isDone(f, nv, a)) ?? null), 320)

  const applySig = (f: SignerField, a: AdoptedSignature) => {
    const nv = { ...vals, [f.id]: true }
    setVals(nv)
    setFresh(f.id)
    advance(nv, a)
  }

  const finish = async () => {
    if (cur || busy) return
    setBusy(true)
    setError(null)
    const values: Vals = {}
    for (const f of mine) if (f.type === 'name' || f.type === 'text' || f.type === 'checkbox') values[f.id] = f.type === 'checkbox' ? vals[f.id] === true : String(vals[f.id] ?? '')
    const needsSig = mine.some((f) => f.type === 'signature' || f.type === 'initials')
    try {
      const r = await signer.submit(token, session, values, needsSig ? adopted : null)
      sessionStore.clear(token)
      onFinished(r)
    } catch (e) {
      const err = e as SignerError
      if (err.code === 'session') return onSessionLost()
      setError(
        err.code === 'required_missing'
          ? 'Some required fields are still empty.'
          : err.code === 'not_your_turn'
          ? 'This document can’t be signed right now. Reload the page.'
          : 'Couldn’t finish signing. Nothing was lost; try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  let gi = 0
  const pages = doc.documents.flatMap((d) => Array.from({ length: d.pages }, (_, i) => ({ d, i, gi: gi++ })))
  const pageSizeOf = (g: number) => {
    const p = pages.find((x) => x.gi === g)
    return p?.d.page_sizes[p.i] ?? { w: 612, h: 792 }
  }
  const firstDoc = doc.documents[0]?.name.replace(/\.pdf$/i, '') ?? doc.title
  const nextBtn =
    done === all ? (
      <Button icon={Check} onClick={() => void finish()} loading={busy} className={mobile ? 'h-11 flex-1 text-[14px]' : undefined}>
        Finish
      </Button>
    ) : (
      <Button iconRight={ArrowDown} onClick={() => go(cur)} className={mobile ? 'h-11 flex-1 text-[14px]' : undefined}>
        {done === 0 ? 'Start' : 'Next field'}
      </Button>
    )
  const progress = (
    <div className="flex items-center gap-2.5 whitespace-nowrap font-inter text-[12px] tabular-nums text-text-secondary">
      <span className="h-1.5 w-[110px] overflow-hidden rounded-full bg-[#ECEAE2]">
        <span
          className="gio-progress-fill block h-full w-full origin-left rounded-full"
          style={{ transform: `scaleX(${all ? done / all : 1})`, background: done === all ? '#16704A' : '#0d0d09' }}
        />
      </span>
      {done} of {all} required
    </div>
  )

  const field = (f: SignerField) => {
    const st = { left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }
    const isCur = cur?.id === f.id
    const capText = f.type === 'signature' ? 'Signature' : f.type === 'initials' ? 'Initials' : f.type === 'name' ? 'Full name' : f.type === 'text' ? f.label || 'Text' : null
    const cap = capText && f.owner === 'me' && f.type !== 'checkbox' ? <span className="gio-sf-cap">{capText}{f.required ? ' *' : ''}</span> : null
    const nx = isCur && !mobile ? <span className="gio-sf-next">{done === 0 ? 'Start' : 'Next'}</span> : null

    if (f.owner === 'data') {
      return (
        <div key={f.id} className="gio-sf" data-kind="data" style={st}>
          <DataFieldText value={f.value} tick={f.style === 'tick'} w={f.w} h={f.h} page={pageSizeOf(f.page)} fontSize={f.font_size} />
        </div>
      )
    }
    if (f.owner === 'other') {
      const signed = !!f.value
      return (
        <div key={f.id} className="gio-sf" data-kind="other" style={st}>
          {signed ? <Check className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden /> : <Clock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />}
          <span className="truncate">{f.type === 'signature' || f.type === 'initials' ? (signed ? `Signed by ${f.owner_name}` : `${f.owner_name} signs here`) : f.value || f.owner_name}</span>
        </div>
      )
    }
    if (f.type === 'signature' || f.type === 'initials') {
      return vals[f.id] === true && adopted ? (
        <button
          key={f.id}
          type="button"
          data-fid={f.id}
          className="gio-sf"
          data-kind="done"
          style={st}
          aria-label={`${capText}: signed. Change signature`}
          onClick={() => setAdopt({ field: f, change: true })}
        >
          {cap}
          <span className="gio-sf-ink" key={fresh === f.id ? 'fresh' : 'ink'}>
            <img src={f.type === 'initials' ? adopted.initialsImage ?? adopted.image : adopted.image} alt={`Signature of ${adopted.fullName}`} />
          </span>
          {f.type === 'signature' && <span className="gio-sf-id">Gio Sign · {doc.public_id}</span>}
        </button>
      ) : (
        <button
          key={f.id}
          type="button"
          data-fid={f.id}
          className="gio-sf"
          data-kind="todo"
          data-current={isCur || undefined}
          style={st}
          onClick={() => (adopted ? applySig(f, adopted) : setAdopt({ field: f, change: false }))}
          aria-label={f.type === 'initials' ? 'Initial here' : 'Sign here'}
        >
          {cap}
          {nx}
          {f.type === 'initials' ? <Type className="h-3 w-3" strokeWidth={2} aria-hidden /> : <PenLine className="h-3 w-3" strokeWidth={2} aria-hidden />}
          {f.type === 'initials' ? 'Initial' : 'Sign'}
        </button>
      )
    }
    if (f.type === 'checkbox') {
      const on = vals[f.id] === true
      return (
        <div
          key={f.id}
          data-fid={f.id}
          role="checkbox"
          aria-checked={on}
          aria-label={f.label || 'Checkbox'}
          tabIndex={0}
          className="gio-sf"
          data-kind="check"
          data-on={on || undefined}
          data-current={isCur || undefined}
          style={st}
          onClick={() => {
            const nv = { ...vals, [f.id]: !on }
            setVals(nv)
            if (!on) advance(nv, adopted)
          }}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setVals({ ...vals, [f.id]: !on })
            }
          }}
        >
          {nx}
          <span className="gio-sf-box">{on && <Check className="h-2.5 w-2.5" strokeWidth={2.2} aria-hidden />}</span>
          {f.label && <span className="truncate">{f.label}{f.required ? ' *' : ''}</span>}
        </div>
      )
    }
    if (f.type === 'email' || f.type === 'date') {
      return (
        <div key={f.id} data-fid={f.id} className="gio-sf" data-kind="lock" style={st}>
          {f.type === 'email' ? <Lock className="h-3 w-3 shrink-0 text-text-tertiary" strokeWidth={2} aria-hidden /> : <Calendar className="h-3 w-3 shrink-0 text-text-tertiary" strokeWidth={2} aria-hidden />}
          <span className="truncate">{f.type === 'email' ? doc.recipient.email : doc.today}</span>
        </div>
      )
    }
    return (
      <label key={f.id} data-fid={f.id} className="gio-sf" style={st}>
        {cap}
        {nx}
        <input
          value={String(vals[f.id] ?? '')}
          aria-label={capText ?? 'Text'}
          aria-required={f.required}
          maxLength={f.type === 'name' ? 200 : 2000}
          onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && go(cur)}
        />
      </label>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#ECEAE2]">
      <header className="z-10 flex h-[60px] shrink-0 items-center gap-3.5 border-b border-[#E7E8EE] bg-white px-4 sm:px-[18px]">
        <Logo className={mobile ? 'h-[18px]' : 'h-[22px]'} />
        <span aria-hidden className="h-6 w-px bg-[#E7E8EE]" />
        <div className="flex min-w-0 flex-col">
          <b className="truncate font-poppins text-[14px] font-semibold tracking-[-0.02em] text-text-primary">{firstDoc}</b>
          <span className="truncate font-inter text-[11.5px] text-text-tertiary">{doc.brand}</span>
        </div>
        <span className="flex-1" />
        {!mobile && progress}
        <DropdownMenu>
          <IconTip label="More">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="md" iconOnly aria-label="More">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </IconTip>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onClick={onDecline} className="text-destructive focus:text-destructive">
              <CircleX className="h-3.5 w-3.5" aria-hidden /> Decline to sign
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!mobile && nextBtn}
      </header>
      {prefilled > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#E6DAFD] bg-[#F3EDFE] px-4 py-2 font-inter text-[12.5px] text-[#4C1D95] sm:px-[18px]">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-virgilio-purple" strokeWidth={2} aria-hidden />
          <span>Some details are already filled in for you. Check them, then sign where it’s highlighted.</span>
        </div>
      )}
      {error && (
        <div className="shrink-0 border-b border-[#F7D1D4] bg-[#FDECEE] px-4 py-2 font-inter text-[12.5px] text-[#B42318] sm:px-[18px]" role="alert">
          {error}
        </div>
      )}
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col items-center gap-[18px] overflow-auto px-3 pb-[120px] pt-6 sm:px-5 sm:pt-7">
        {pages.map((p) => (
          <div key={`${p.d.id}-${p.i}`} className="w-full max-w-[720px]">
            <SignerPage docId={p.d.id} url={p.d.url} index={p.i} size={p.d.page_sizes[p.i] ?? { w: 612, h: 792 }}>
              {doc.fields.filter((f) => f.page === p.gi).map(field)}
            </SignerPage>
            <p className="mt-1.5 flex justify-between font-inter text-[11px] text-text-tertiary">
              <span className="truncate">{p.d.name}</span>
              <span className="tabular-nums">
                {p.i + 1} / {p.d.pages}
              </span>
            </p>
          </div>
        ))}
      </div>
      {mobile && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2.5 border-t border-[#E7E8EE] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
          <div className="flex flex-col gap-1 font-inter text-[11px] tabular-nums text-text-secondary">
            <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-[#ECEAE2]">
              <span className="gio-progress-fill block h-full w-full origin-left rounded-full" style={{ transform: `scaleX(${all ? done / all : 1})`, background: done === all ? '#16704A' : '#0d0d09' }} />
            </span>
            {done}/{all} done
          </div>
          {nextBtn}
        </div>
      )}
      {adopt && (
        <AdoptSignature
          open
          mobile={mobile}
          defaultName={doc.recipient.name}
          initial={adopt.change ? adopted : null}
          onOpenChange={(o) => !o && setAdopt(null)}
          onAdopt={(a) => {
            const f = adopt.field
            setAdopted(a)
            setAdopt(null)
            if (!adopt.change && f) applySig(f, a)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

type View =
  | { k: 'loading' }
  | { k: 'not_found' }
  | { k: 'error' }
  | { k: 'gate'; info: SignerOpen }
  | { k: 'doc'; info: SignerOpen; session: string; doc: SignerDocument }
  | { k: 'done'; info: SignerOpen; status: 'sent' | 'completed'; next: string[]; at: string }
  | { k: 'declined'; info: SignerOpen; reason: string }
  | { k: 'state'; info: SignerOpen }

/** app.gogio.io/s/:token — a signer's own envelope. No account, no app shell. */
export default function SigningPage() {
  const { token = '' } = useParams<{ token: string }>()
  const mobile = useIsMobile()
  const [view, setView] = useState<View>({ k: 'loading' })
  const [declineOpen, setDeclineOpen] = useState(false)
  // §16: a first load with no answer after 15s turns into Retry.
  const [attempt, setAttempt] = useState(0)
  const loading = view.k === 'loading'
  const timedOut = useLoadTimeout(loading, attempt)
  useSignatureFonts()
  useReportSplashReady(view.k !== 'loading')

  useEffect(() => {
    document.title = 'Sign · Gio Sign'
  }, [])

  const start = useCallback(async () => {
    setView({ k: 'loading' })
    let info: SignerOpen
    try {
      info = await signer.open(token)
    } catch (e) {
      setView((e as SignerError).code === 'not_found' ? { k: 'not_found' } : { k: 'error' })
      return
    }
    if (info.state !== 'open') return setView({ k: 'state', info })
    const s = sessionStore.get(token)
    if (s) {
      try {
        const doc = await signer.load(token, s)
        return setView({ k: 'doc', info, session: s, doc })
      } catch {
        sessionStore.clear(token)
      }
    }
    setView({ k: 'gate', info })
  }, [token])

  useEffect(() => {
    void start()
  }, [start])

  const openDoc = async (info: SignerOpen, session: string) => {
    try {
      const doc = await signer.load(token, session)
      setView({ k: 'doc', info, session, doc })
    } catch {
      setView({ k: 'error' })
    }
  }

  const skeleton = (
      <Centered>
        <Card>
          <div className="flex flex-col gap-3 p-7">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </Card>
      </Centered>
  )

  let body: React.ReactNode = null
  if (view.k === 'loading') {
    if (timedOut) {
      body = (
        <Centered>
          <LoadError
            what="your documents"
            timedOut
            onRetry={() => {
              setAttempt((n) => n + 1)
              void start()
            }}
          />
        </Centered>
      )
    }
  } else if (view.k === 'not_found') {
    body = (
      <Terminal icon={<CircleX className="h-6 w-6" strokeWidth={2} />} tone="muted" title="This link doesn’t work">
        <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
          It may have been replaced by a newer one, or it was copied incompletely. Open the most recent email you got about this document, or reply to it to ask for a
          new link.
        </p>
      </Terminal>
    )
  } else if (view.k === 'error') {
    body = (
      <Terminal icon={<CircleX className="h-6 w-6" strokeWidth={2} />} tone="warn" title="Couldn’t open the document">
        <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">Check your connection and try again.</p>
        <Button className="self-start" onClick={() => void start()}>
          Try again
        </Button>
      </Terminal>
    )
  } else if (view.k === 'gate') {
    body = <Gate token={token} info={view.info} onVerified={(s) => void openDoc(view.info, s)} />
  } else if (view.k === 'doc') {
    body = (
      <SignDocument
        token={token}
        session={view.session}
        doc={view.doc}
        mobile={mobile}
        onFinished={(r) => setView({ k: 'done', info: view.info, status: r.status, next: r.next, at: r.signed_at })}
        onDecline={() => setDeclineOpen(true)}
        onSessionLost={() => {
          sessionStore.clear(token)
          setView({ k: 'gate', info: { ...view.info, code_sent_at: null } })
        }}
      />
    )
  } else if (view.k === 'done') {
    const when = new Date(view.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    body = (
      <Terminal icon={<Check className="h-6 w-6" strokeWidth={2} />} tone="ok" title={`You’ve signed, ${view.info.recipient.first_name}`}>
        <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
          {view.status === 'completed'
            ? `Everyone has signed. You’ll get the final sealed PDF by email.`
            : `${view.next.join(' and ') || 'The next person'} signs next, and you’ll get the final sealed PDF by email as soon as everyone has signed.`}
        </p>
        <div className="overflow-hidden rounded-xl border border-[#E7E8EE] font-inter text-[12.5px]">
          <div className="flex items-center gap-2.5 border-b border-[#F1F0EC] px-3 py-2.5 last:border-b-0">
            <Check className="h-3.5 w-3.5 text-[#16704A]" strokeWidth={2} aria-hidden />
            <span className="font-medium">You signed</span>
            <span className="ml-auto tabular-nums text-text-tertiary">{when}</span>
          </div>
          {view.next.map((n) => (
            <div key={n} className="flex items-center gap-2.5 border-b border-[#F1F0EC] px-3 py-2.5 last:border-b-0">
              <Clock className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={2} aria-hidden />
              <span>{n}</span>
              <span className="ml-auto text-text-tertiary">Waiting</span>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 font-inter text-[11.5px] tabular-nums text-text-tertiary">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Envelope ID {view.info.public_id} · every step is in the certificate of completion
        </p>
      </Terminal>
    )
  } else if (view.k === 'declined') {
    body = (
      <Terminal icon={<CircleX className="h-6 w-6" strokeWidth={2} />} tone="muted" title="You declined to sign">
        <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
          We’ve told {view.info.sender_name}, with your reason: “{view.reason}”. The link no longer opens the document. If this was a mistake, reply to the invitation
          email.
        </p>
      </Terminal>
    )
  } else {
    const { info } = view
    const s = info.state
    body =
      s === 'signed' ? (
        <Terminal icon={<Check className="h-6 w-6" strokeWidth={2} />} tone="ok" title="You’ve already signed">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">You’ll get the final sealed PDF by email as soon as everyone has signed.</p>
        </Terminal>
      ) : s === 'completed' ? (
        <Terminal icon={<Check className="h-6 w-6" strokeWidth={2} />} tone="ok" title="Everyone has signed">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">The final sealed PDF is sent to everyone by email.</p>
        </Terminal>
      ) : s === 'waiting' ? (
        <Terminal icon={<Clock className="h-6 w-6" strokeWidth={2} />} tone="muted" title="It’s not your turn yet">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
            Someone else signs before you. We’ll email you as soon as it’s ready for you.
          </p>
        </Terminal>
      ) : s === 'copy' ? (
        <Terminal icon={<FileText className="h-6 w-6" strokeWidth={2} />} tone="muted" title="You’re getting a copy">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">There’s nothing for you to sign. You’ll get the final sealed PDF once everyone has signed.</p>
        </Terminal>
      ) : s === 'declined' ? (
        <Terminal icon={<CircleX className="h-6 w-6" strokeWidth={2} />} tone="muted" title="This document was declined">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
            {info.declined_by ? `${info.declined_by} declined to sign, so` : 'Someone declined to sign, so'} it can’t be signed any more. {info.sender_name} has been told.
          </p>
        </Terminal>
      ) : s === 'voided' ? (
        <Terminal icon={<CircleX className="h-6 w-6" strokeWidth={2} />} tone="muted" title="This document was cancelled">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
            {info.sender_name} cancelled it, so it can’t be signed. If you expected to sign it, reply to the invitation email.
          </p>
        </Terminal>
      ) : (
        <Terminal icon={<Clock className="h-6 w-6" strokeWidth={2} />} tone="warn" title="This link has expired">
          <p className="font-inter text-[13.5px] leading-relaxed text-text-secondary">
            Ask {info.sender_name} to send it again. You can reply to the invitation email.
          </p>
        </Terminal>
      )
  }

  return (
    <>
      <Loadable loading={loading && !timedOut} skeleton={skeleton}>
        {body}
      </Loadable>
      {view.k === 'doc' && (
        <DeclineDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          senderName={view.info.sender_name}
          token={token}
          session={view.session}
          onDeclined={(reason) => {
            setDeclineOpen(false)
            sessionStore.clear(token)
            setView({ k: 'declined', info: view.info, reason })
          }}
        />
      )}
    </>
  )
}

/* --------------------------------------------------------------- decline */

function DeclineDialog({
  open,
  onOpenChange,
  senderName,
  token,
  session,
  onDeclined,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  senderName: string
  token: string
  session: string
  onDeclined: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])
  const submit = async () => {
    if (reason.trim().length < 3 || busy) return
    setBusy(true)
    setError(null)
    try {
      await signer.decline(token, session, reason.trim())
      onDeclined(reason.trim())
    } catch {
      setError('Couldn’t record that. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[420px] rounded-2xl p-0">
        <div className="flex items-start gap-3 px-6 pb-2 pt-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDECEE] text-[#C2372B]">
            <CircleX className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-poppins text-[17px] font-semibold tracking-[-0.02em] text-text-primary">Decline to sign?</DialogTitle>
            <DialogDescription className="mt-1 font-inter text-[13px] leading-normal text-text-secondary">
              {senderName} will be told, and this document can’t be signed after that.
            </DialogDescription>
          </div>
        </div>
          <div className="flex flex-col gap-1.5 px-6 pb-2 pt-2">
            <label htmlFor="decline-reason" className="font-inter text-[12.5px] font-medium text-text-primary">
              Reason <span className="text-virgilio-error">*</span>
            </label>
            <Textarea id="decline-reason" rows={3} maxLength={500} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder={`Tell ${senderName} why`} />
            <p className="min-h-[18px] font-inter text-[12px] text-virgilio-error" role={error ? 'alert' : undefined}>
              {error}
            </p>
          </div>
        <div className="flex justify-end gap-2 border-t border-[#F1F0EC] px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="dangerSolid" disabled={reason.trim().length < 3} loading={busy} onClick={() => void submit()}>
            Decline to sign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
