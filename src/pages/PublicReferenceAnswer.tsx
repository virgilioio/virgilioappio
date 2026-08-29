/**
 * Flow D — the referee answers the questionnaire. Token-resolved, no Gio
 * account. Route: /reference/:token
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Clock, Loader2, Send, ShieldOff } from 'lucide-react'

import { PublicPageShell } from '@/components/public/PublicPageShell'
import { QuestionInstrument } from '@/components/public/QuestionInstrument'
import { TerminalCard } from '@/components/public/TerminalCard'
import {
  declineReference,
  resolveRefereeToken,
  saveRefereeDraft,
  submitReferee,
  type RefereeResolve,
} from '@/lib/references/publicApi'

type Answers = Record<string, unknown>

export default function PublicReferenceAnswer() {
  const { token = '' } = useParams()
  const [data, setData] = useState<RefereeResolve | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [answers, setAnswers] = useState<Answers>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [terminal, setTerminal] = useState<'submitted' | 'declined' | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const answersRef = useRef<Answers>({})

  useEffect(() => {
    let alive = true
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
      .catch(() => alive && setLoadError(true))
    return () => {
      alive = false
    }
  }, [token])

  const setAnswer = (id: string, value: unknown) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value }
      answersRef.current = next
      return next
    })
    setMissing((prev) => prev.filter((x) => x !== id))
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
    if (!data) return
    setSubmitting(true)
    try {
      await submitReferee(token, answersRef.current)
      setTerminal('submitted')
    } catch (e) {
      const ids = (e as { details?: { question_ids?: string[] } })?.details?.question_ids
      if (ids?.length) {
        setMissing(ids)
        const el = document.getElementById(`q-${ids[0]}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!window.confirm('Decline this reference request? Nothing you typed will be kept.')) return
    try {
      await declineReference(token)
    } finally {
      setTerminal('declined')
    }
  }

  if (loadError) {
    return (
      <PublicPageShell agencyName="References" pageKind="Reference" width={720}>
        <TerminalCard
          tone="neutral"
          title="This link has expired"
          body="Reference links are time-limited for privacy. If you still want to help, ask the recruiter who contacted you for a fresh link."
        />
      </PublicPageShell>
    )
  }

  if (!data) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: '100dvh', background: '#FAF8F3' }}
      >
        <Loader2 className="animate-spin" size={22} color="#8B8F9E" />
      </div>
    )
  }

  const shell = (children: React.ReactNode) => (
    <PublicPageShell
      agencyName={data.brand.agency_name}
      logoUrl={data.brand.logo_url}
      pageKind="Reference"
      width={720}
      footnote="Your answers are shared with the hiring team, never with the candidate."
    >
      {children}
    </PublicPageShell>
  )

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
            className="font-inter inline-flex items-center"
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
              <div style={{ marginTop: 11, marginLeft: 26 }}>
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
      <div
        className="flex flex-wrap items-center"
        style={{ marginTop: 20, gap: 12, paddingTop: 16, borderTop: '1px solid #F1F0EC' }}
      >
        <span className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
          {saving
            ? 'Saving…'
            : savedAt
              ? 'Saved — you can close this page and come back to the same link.'
              : 'Your answers save as you go.'}
        </span>
        <span className="flex items-center" style={{ marginLeft: 'auto', gap: 12 }}>
          <button
            type="button"
            onClick={autosave}
            className="font-inter"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#5A6072',
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Finish later
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="font-poppins inline-flex items-center justify-center submit-btn"
            style={{
              gap: 8,
              height: 44,
              padding: '0 20px',
              borderRadius: 10,
              border: 'none',
              background: '#0d0d09',
              color: '#fffcf9',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Submit reference
          </button>
        </span>
      </div>
      {missing.length > 0 && (
        <p className="font-inter" style={{ marginTop: 10, fontSize: 12, color: '#D9382C' }}>
          A few required questions still need an answer.
        </p>
      )}
      <style>{`@media (max-width:759px){.submit-btn{width:100%;}}`}</style>
    </>,
  )
}
