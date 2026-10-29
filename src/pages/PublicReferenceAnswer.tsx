/**
 * Flow D — the referee answers the questionnaire. Token-resolved, no Gio
 * account. Route: /reference/:token
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { Clock, Send, ShieldOff, UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Loadable } from '@/components/ui/loadable'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { shakeFirstInvalid } from '@/lib/motion'
import { PublicFormSkeleton } from '@/components/public/PublicFormSkeleton'
import { SubmitErrorLine, type SubmitError } from '@/components/public/SubmitErrorLine'

import { PublicPageShell } from '@/components/public/PublicPageShell'
import { QuestionInstrument } from '@/components/public/QuestionInstrument'
import { TerminalCard } from '@/components/public/TerminalCard'
import {
  declineReference,
  isGoneLink,
  PublicRefError,
  resolveRefereeToken,
  saveRefereeDraft,
  submitReferee,
  type RefereeResolve,
} from '@/lib/references/publicApi'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

type Answers = Record<string, unknown>

/** An answer counts once it holds something: text, a choice, or any part of a range. */
function answered(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.replace(' to ', '').trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(answered)
  return true
}

export default function PublicReferenceAnswer() {
  const { token = '' } = useParams()
  const [searchParams] = useSearchParams()
  const declineIntent = searchParams.get('decline') === '1'
  const [data, setData] = useState<RefereeResolve | null>(null)
  // A gone link (unknown or expired token) is final; anything else can be retried.
  const [gone, setGone] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [submitError, setSubmitError] = useState<SubmitError>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [terminal, setTerminal] = useState<'submitted' | 'declined' | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const answersRef = useRef<Answers>({})

  // Public route: nothing else in the tree clears the cold-load splash when the
  // visitor happens to have a (possibly stale) Gio session, so report it here.
  const loading = !data && !gone && !loadFailed
  const timedOut = useLoadTimeout(loading, retryKey)
  useReportSplashReady(!loading || timedOut)

  useEffect(() => {
    let alive = true
    setLoadFailed(false)
    resolveRefereeToken(token)
      .then((d) => {
        if (!alive) return
        setData(d)
        // employment_verification is ALWAYS empty on load, even from a draft.
        const draft: Answers = { ...(d.draft_answers as Answers) }
        d.questions
          .filter((q) => q.type === 'employment_verification')
          .forEach((q) => delete draft[q.id])
        setAnswers(draft)
        answersRef.current = draft
        document.title = `A reference for ${d.candidate_name} · ${d.brand.agency_name}`
      })
      .catch((e) => {
        if (!alive) return
        if (isGoneLink(e)) setGone(true)
        else setLoadFailed(true)
      })
    return () => {
      alive = false
    }
  }, [token, retryKey])

  const setAnswer = (id: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value }
      answersRef.current = next
      return next
    })
    if (answered(value)) setMissing((prev) => prev.filter((x) => x !== id))
  }

  // §7: name what's missing in the reserved line and shake the first one, once.
  const flagMissing = (ids: string[]) => {
    setMissing(ids)
    setSubmitError({
      text:
        ids.length === 1
          ? 'One required question still needs an answer.'
          : `${ids.length} required questions still need an answer.`,
    })
    shakeFirstInvalid()
  }

  const autosave = useCallback(async () => {
    if (!data || data.status !== 'open') return
    setSaving(true)
    try {
      const res = await saveRefereeDraft(token, answersRef.current)
      setSavedAt(res.saved_at)
    } catch {
      /* autosave is best-effort — the referee can still submit */
    } finally {
      setSaving(false)
    }
  }, [data, token])

  const questions = data?.questions ?? []
  const firstRatingId = useMemo(
    () => questions.find((q) => q.type === 'rating_1_5')?.id ?? null,
    [questions],
  )

  const handleSubmit = async () => {
    if (!data || submitting) return
    const unanswered = (data.questions ?? [])
      .filter((q) => q.required && q.type !== 'section_header' && !answered(answersRef.current[q.id]))
      .map((q) => q.id)
    if (unanswered.length) {
      flagMissing(unanswered)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitReferee(token, answersRef.current)
      setTerminal('submitted')
    } catch (e) {
      const code = e instanceof PublicRefError ? e.code : ''
      const ids = (e as { details?: { question_ids?: string[] } })?.details?.question_ids
      if (ids?.length) flagMissing(ids)
      else if (code === 'not_found') setGone(true)
      else if (code === 'already_submitted') setTerminal('submitted')
      else if (code === 'declined') setTerminal('declined')
      else if (code === 'cancelled') setData((d) => (d ? { ...d, status: 'cancelled' } : d))
      else if (code === 'rate_limited')
        setSubmitError({ text: 'Too many tries. Wait a minute, then try again.' })
      else setSubmitError({ text: 'Couldn’t send', retry: true })
    } finally {
      setSubmitting(false)
    }
  }

  // O4 (Block B §16, Pattern 1): say what happens, for the referee's phone too.
  const candidateName = data?.candidate_name?.trim() || ''
  const recruiterName = data?.recruiter_name?.trim() || ''
  const handleDecline = useCallback(async () => {
    const ok = await confirmDestructive({
      icon: UserX,
      title: candidateName ? `Decline to give a reference for ${candidateName}?` : 'Decline this reference request?',
      description: `${recruiterName ? `We\u2019ll let ${recruiterName} know` : 'We\u2019ll let the hiring team know'}, and nothing you\u2019ve typed is kept. ${candidateName || 'The candidate'} isn\u2019t told who declined. This link stops working afterwards.`,
      confirmLabel: 'Decline reference',
    })
    if (!ok) return
    try {
      await declineReference(token)
      setTerminal('declined')
    } catch (e) {
      // Already declined (another tab, the email link): show the same end state.
      if ((e as { code?: string })?.code === 'declined') setTerminal('declined')
      else toast.error('We couldn\u2019t record that you declined. Nothing was sent; try again.')
    }
  }, [token, candidateName, recruiterName])

  // The email's decline link lands here with ?decline=1 — open the confirm
  // straight away so declining really is one click.
  const declinePrompted = useRef(false)
  useEffect(() => {
    if (!declineIntent || declinePrompted.current) return
    if (!data || data.status !== 'open') return
    declinePrompted.current = true
    void handleDecline()
  }, [declineIntent, data, handleDecline])

  // One shell for every state, so the questions crossfade in over their skeleton (§16).
  const failed = !data && (loadFailed || timedOut)
  const shell = (children: ReactNode) => (
    <PublicPageShell
      agencyName={data?.brand.agency_name ?? (gone ? 'References' : '')}
      logoUrl={data?.brand.logo_url}
      pageKind="Reference"
      width={720}
      footnote="Your answers are shared with the hiring team, never with the candidate."
    >
      <Loadable loading={!data && !gone && !failed} skeleton={<PublicFormSkeleton />}>
        {children}
      </Loadable>
    </PublicPageShell>
  )

  if (gone) {
    return shell(
      <TerminalCard
        tone="neutral"
        title="This link has expired"
        body="Reference links are time-limited for privacy. If you still want to help, ask the recruiter who contacted you for a fresh link."
      />,
    )
  }

  if (!data) {
    return shell(
      failed ? (
        <LoadError
          what="this reference"
          timedOut={timedOut && !loadFailed}
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      ) : null,
    )
  }

  if (terminal === 'submitted' || data.status === 'submitted') {
    return shell(
      <TerminalCard
        tone="green"
        title="Reference submitted"
        body={`Thank you. Your answers about ${data.candidate_name} have gone to the hiring team. There’s nothing else to do.`}
        foot="You can close this page. The link will stop working shortly."
      />,
    )
  }

  if (terminal === 'declined' || data.status === 'declined') {
    return shell(
      <TerminalCard
        tone="neutral"
        title="You’ve declined"
        body={`We’ve let ${data.recruiter_name} know and nothing you typed has been kept. ${data.candidate_name} is not told who declined.`}
      />,
    )
  }

  if (data.status === 'cancelled') {
    return shell(
      <TerminalCard
        tone="neutral"
        title="This request was withdrawn"
        body="The hiring team no longer needs this reference. You can close this page."
      />,
    )
  }

  const initials = (data.candidate_name || '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return shell(
    <>
      {/* Header */}
      <div className="flex items-center" style={{ gap: 12 }}>
        <span
          className="font-poppins inline-flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: '#EDE4FF',
            color: '#4B22B8',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {initials}
        </span>
        <div>
          <h1
            className="font-poppins"
            style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.04em', color: '#1F2230' }}
          >
            A reference for {data.candidate_name}
            <span style={{ color: '#6F3FF5' }}>.</span>
          </h1>
          <p className="font-inter" style={{ fontSize: 13, color: '#5A6072', marginTop: 3 }}>
            They’ve applied for a <strong style={{ fontWeight: 600 }}>{data.job_title}</strong> role
            {data.client_name ? ` with ${data.client_name}` : ''}.
          </p>
        </div>
        <span
          className="font-inter inline-flex items-center"
          style={{
            marginLeft: 'auto',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 999,
            background: '#F4F3EE',
            color: '#5A6072',
            fontSize: 11.5,
            whiteSpace: 'nowrap',
          }}
        >
          <Clock size={12} />
          About {data.estimated_minutes} min
        </span>
      </div>

      {data.resumed && (
        <div
          className="font-inter"
          style={{
            marginTop: 16,
            padding: '11px 13px',
            borderRadius: 11,
            background: '#FAF8FF',
            border: '1px solid #EDE4FF',
            fontSize: 12.5,
            color: '#4B22B8',
          }}
        >
          We picked up where you left off — your earlier answers are still here.
        </div>
      )}

      {/* Privacy + decline, above every question */}
      <section
        style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 12,
          background: '#F7F6F2',
          border: '1px solid #EDEBE3',
        }}
      >
        <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.65, color: '#1F2230' }}>
          Your answers are shared with the hiring team at{' '}
          {data.client_name || data.brand.agency_name} and are never shown to{' '}
          {data.candidate_name}. They are kept only as long as this hiring decision needs them, they
          are not used to train anything, you can ask for them to be deleted at any time, and taking
          part is entirely your choice.
        </p>
        <div className="flex flex-wrap items-center" style={{ gap: 14, marginTop: 11 }}>
          <a
            href="/privacy"
            className="font-inter"
            style={{ fontSize: 11.5, color: '#5A6072', textDecoration: 'underline' }}
          >
            Read the privacy notice
          </a>
          <button
            type="button"
            onClick={handleDecline}
            className="font-inter inline-flex items-center gio-pressable"
            style={{
              gap: 6,
              border: 'none',
              background: 'transparent',
              color: '#D9382C',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ShieldOff size={13} />
            I’d rather not take part
          </button>
        </div>
      </section>

      {/* Questions */}
      <section style={{ marginTop: 24 }}>
        {questions.map((q, i) => {
          if (q.type === 'section_header') {
            return (
              <p
                key={q.id}
                className="font-poppins"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: '#8B8F9E',
                  textTransform: 'uppercase',
                  margin: '26px 0 4px',
                }}
              >
                {q.label}
              </p>
            )
          }
          const index = questions
            .slice(0, i + 1)
            .filter((x) => x.type !== 'section_header').length
          const isMissing = missing.includes(q.id)
          return (
            <div
              key={q.id}
              id={`q-${q.id}`}
              style={{
                padding: '18px 0',
                borderTop: '1px solid #F6F5F1',
              }}
            >
              <div className="flex items-baseline" style={{ gap: 10 }}>
                <span
                  className="font-mono"
                  style={{ fontSize: 11, color: isMissing ? '#D9382C' : '#8B8F9E' }}
                >
                  {String(index).padStart(2, '0')}
                </span>
                <p
                  className="font-poppins"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1F2230',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {q.label}
                  {q.required && <span style={{ color: '#E8590C' }}> *</span>}
                </p>
              </div>
              {q.helper && (
                <p
                  className="font-inter"
                  style={{ fontSize: 11.5, color: '#8B8F9E', margin: '4px 0 0 26px' }}
                >
                  {q.helper}
                </p>
              )}
              <div
                style={{ marginTop: 11, marginLeft: 26 }}
                tabIndex={isMissing ? -1 : undefined}
                aria-invalid={isMissing || undefined}
                aria-label={isMissing ? `${q.label} (needs an answer)` : undefined}
              >
                <QuestionInstrument
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                  onBlur={autosave}
                  showRatingLegend={q.id === firstRatingId}
                />
              </div>
            </div>
          )
        })}
      </section>

      {/* Footer */}
      <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #F1F0EC' }}>
        <SubmitErrorLine error={submitError} onRetry={handleSubmit} retrying={submitting} />
      </div>
      <div className="flex flex-wrap items-center" style={{ marginTop: 6, gap: 12 }}>
        <span className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
          {saving
            ? 'Saving…'
            : savedAt
              ? 'Saved — you can close this page and come back to the same link.'
              : 'Your answers save as you go.'}
        </span>
        <span className="flex items-center" style={{ marginLeft: 'auto', gap: 12 }}>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={autosave}
            className="font-inter font-normal text-[12.5px] text-[#5A6072]"
          >
            Finish later
          </Button>
          <Button
            type="button"
            variant="primary"
            size="xl"
            icon={Send}
            loading={submitting}
            onClick={handleSubmit}
            className="submit-btn h-[44px] rounded-[10px] text-[13.5px] font-semibold"
          >
            Submit reference
          </Button>
        </span>
      </div>
      <style>{`@media (max-width:759px){.submit-btn{width:100%;}}`}</style>
    </>,
  )
}
