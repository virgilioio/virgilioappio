/**
 * Board 14 · Public reference report — `/report/:token`.
 *
 * The audience is a hiring manager, not a recruiter: no login, no app chrome,
 * agency brand in the header, Gio only in the footer line. The payload is
 * filtered server-side, so Gio's summary and flags, internal questions, the
 * candidate's self-assessment, hold notes, the activity timeline and referee
 * email addresses cannot reach this file at all. Outstanding references are a
 * count only — never a name, never a reason.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Download,
  EyeOff,
  Lock,
  Mail,
  MessageSquareQuote,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'

import { PublicPageShell } from '@/components/public/PublicPageShell'
import {
  Pips,
  RehirePill,
  ReportAnswer,
  ScoreNumeral,
  employmentClaim,
  isEmptyValue,
  numeric,
  scoreTone,
  type ReportAnswerValue,
  type ReportQuestion,
} from '@/components/public/ReportAnswer'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'

interface ReportReferee {
  id: string
  name: string
  relationship?: string | null
  title?: string | null
  company?: string | null
  period?: string | null
  submitted_at?: string | null
  answers: ReportAnswerValue[]
}

interface ReportPayload {
  brand: { agency_name: string; logo_url: string | null }
  candidate_name: string
  job_title: string
  client_name: string
  recruiter_name: string
  recruiter_email: string | null
  questions: ReportQuestion[]
  referee_count: number
  required_count: number
  outstanding: number
  report_date: string
  expires_at: string | null
  referees: ReportReferee[]
}

const INK = '#1F2230'
const MUTED = '#8B8F9E'
const BODY = '#5A6072'

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

const firstName = (n: string) => n.split(' ')[0] || n

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: 999, background: '#D1D0CB' }} aria-hidden />
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline" style={{ gap: 10, flexWrap: 'wrap' }}>
      <span
        className="font-poppins"
        style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.025em', color: '#0d0d09' }}
      >
        {title}
      </span>
      <span className="font-inter" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        {note}
      </span>
    </div>
  )
}

function Tile({
  label,
  children,
  note,
  span,
}: {
  label: string
  children: React.ReactNode
  note?: string
  span?: number
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #ECE7DD',
        borderRadius: 14,
        padding: '14px 16px',
        gridColumn: span ? `span ${span}` : undefined,
        minWidth: 0,
      }}
    >
      <p
        className="font-inter uppercase"
        style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: '0.07em' }}
      >
        {label}
      </p>
      <div style={{ marginTop: 10 }}>{children}</div>
      {note && (
        <p className="font-inter" style={{ fontSize: 11, color: MUTED, marginTop: 9, lineHeight: 1.5 }}>
          {note}
        </p>
      )}
    </div>
  )
}

export default function PublicReferenceReport() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ReportPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useReportSplashReady(!!data || !!error)

  // This page must never be searchable, and must not leak the token by referrer.
  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow, noarchive'
    const referrer = document.createElement('meta')
    referrer.name = 'referrer'
    referrer.content = 'no-referrer'
    document.head.append(robots, referrer)
    return () => {
      robots.remove()
      referrer.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.functions
      .invoke('reference-report', { body: { action: 'resolve', token } })
      .then(({ data: res, error: err }) => {
        if (cancelled) return
        if (err || !res || (res as { error?: string }).error) setError('not_found')
        else setData(res as ReportPayload)
      })
      .catch(() => !cancelled && setError('not_found'))
    return () => {
      cancelled = true
    }
  }, [token])

  const model = useMemo(() => {
    if (!data) return null
    const q = data.questions ?? []
    const byType = (t: string) => q.filter((x) => x.type === t)
    const ratings = byType('rating_1_5')
    const recQ = byType('recommendation_score')[0] ?? null
    const rehireQ = byType('would_rehire')[0] ?? null
    const employmentQ = byType('employment_verification')[0] ?? null
    const longText = byType('long_text')
    const factual = q.filter(
      (x) =>
        !['rating_1_5', 'recommendation_score', 'would_rehire', 'long_text', 'section_header', 'employment_verification'].includes(
          x.type,
        ),
    )

    const answerOf = (r: ReportReferee, id?: string | null) =>
      id ? r.answers.find((a) => a.id === id)?.value ?? null : null

    const scores = data.referees
      .map((r) => ({ name: firstName(r.name), value: numeric(answerOf(r, recQ?.id)) }))
      .filter((s): s is { name: string; value: number } => s.value !== null)
    const mean = scores.length ? scores.reduce((s, x) => s + x.value, 0) / scores.length : null

    const ratingMeans = ratings
      .map((rq) => {
        const vals = data.referees
          .map((r) => numeric(answerOf(r, rq.id)))
          .filter((v): v is number => v !== null)
        return vals.length ? { question: rq, value: vals.reduce((a, b) => a + b, 0) / vals.length } : null
      })
      .filter((x): x is { question: ReportQuestion; value: number } => !!x)

    const rehires = data.referees
      .map((r) => ({ name: firstName(r.name), value: answerOf(r, rehireQ?.id) }))
      .filter((x) => !isEmptyValue(x.value))

    const employment = data.referees
      .map((r) => ({ name: firstName(r.name), claim: employmentClaim(answerOf(r, employmentQ?.id)) }))
      .filter((x): x is { name: string; claim: NonNullable<ReturnType<typeof employmentClaim>> } => !!x.claim)

    return { ratings, recQ, rehireQ, employmentQ, longText, factual, answerOf, scores, mean, ratingMeans, rehires, employment }
  }, [data])

  if (error) {
    return (
      <PublicPageShell agencyName="References" pageKind="Reference report" width={800}>
        <div style={{ padding: '32px 4px' }}>
          <h1 className="font-poppins" style={{ fontSize: 20, fontWeight: 600, color: INK }}>
            This report link has expired
          </h1>
          <p className="font-inter" style={{ fontSize: 13, color: BODY, marginTop: 8 }}>
            Contact the recruitment firm for an up-to-date copy.
          </p>
        </div>
      </PublicPageShell>
    )
  }

  if (!data || !model) return null

  const agency = data.brand.agency_name
  const plural = data.outstanding === 1 ? 'reference is' : 'references are'

  return (
    <PublicPageShell
      agencyName={agency}
      logoUrl={data.brand.logo_url}
      pageKind="Reference report"
      width={800}
      footnote={`Confidential — shared with you by ${agency}`}
    >
      {/* ------------------------------------------------------------ masthead */}
      <div className="flex items-start" style={{ gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span
            className="inline-flex items-center font-inter"
            style={{
              gap: 6,
              padding: '3px 9px',
              borderRadius: 999,
              background: '#EDE4FF',
              color: '#5B21B6',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              marginBottom: 10,
            }}
          >
            <ShieldCheck size={12} strokeWidth={2.2} />
            Reference report
          </span>
          <h1
            className="font-poppins"
            style={{
              fontSize: 27,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 1.12,
              color: '#0d0d09',
            }}
          >
            {data.candidate_name}
          </h1>
          <p className="font-inter" style={{ fontSize: 13, color: BODY, marginTop: 5 }}>
            {[data.job_title, data.client_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="report-no-print">
          <Button variant="secondary" size="sm" icon={Download} onClick={() => window.print()}>
            Download PDF
          </Button>
        </div>
      </div>

      <div
        className="flex items-center font-inter"
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid #F1F0EC',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 11.5,
          color: BODY,
        }}
      >
        {[
          {
            icon: <UserRound size={12} color={MUTED} />,
            text: `Prepared by ${data.recruiter_name}, ${agency}`,
          },
          { icon: <CalendarDays size={12} color={MUTED} />, text: fmtDate(data.report_date) },
          {
            icon: <Users size={12} color={MUTED} />,
            text: `${data.referee_count} of ${data.required_count} references in`,
          },
          {
            icon: <Clock size={12} color={MUTED} />,
            text: `Link expires ${fmtDate(data.expires_at)}`,
          },
        ].map((item, i) => (
          <span key={i} className="inline-flex items-center" style={{ gap: 10 }}>
            {i > 0 && <Dot />}
            <span className="inline-flex items-center" style={{ gap: 6 }}>
              {item.icon}
              {item.text}
            </span>
          </span>
        ))}
      </div>

      {/* ----------------------------------------------------------- at a glance */}
      <div
        style={{
          marginTop: 22,
          background: '#FAF8F3',
          border: '1px solid #ECE7DD',
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <SectionHead
            title="At a glance"
            note={`Averaged across ${data.referee_count} completed ${
              data.referee_count === 1 ? 'reference' : 'references'
            }. Every number below is a referee's own answer.`}
          />
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
          {model.mean !== null && (
            <Tile
              label="Recommendation"
              note={`Individually: ${model.scores
                .map((s) => `${s.name} ${Number.isInteger(s.value) ? s.value : s.value.toFixed(1)}`)
                .join(' · ')}`}
            >
              <span className="inline-flex items-baseline" style={{ gap: 4 }}>
                <span
                  className="font-poppins tabular-nums"
                  style={{
                    fontSize: 34,
                    fontWeight: 600,
                    letterSpacing: '-0.045em',
                    lineHeight: 1,
                    color: scoreTone(model.mean),
                  }}
                >
                  {model.mean.toFixed(1)}
                </span>
                <span className="font-inter" style={{ fontSize: 13, color: MUTED }}>
                  /10
                </span>
              </span>
              <div
                style={{
                  marginTop: 11,
                  height: 6,
                  borderRadius: 999,
                  background: '#EDECE8',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, model.mean * 10)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: scoreTone(model.mean),
                  }}
                />
              </div>
            </Tile>
          )}

          {model.rehires.length > 0 && (
            <Tile label="Would rehire">
              <div className="flex flex-col" style={{ gap: 10 }}>
                {model.rehires.map((r) => (
                  <div key={r.name} className="flex flex-col items-start" style={{ gap: 4 }}>
                    <span className="font-inter" style={{ fontSize: 10.5, color: MUTED }}>
                      {r.name}
                    </span>
                    <RehirePill value={String(r.value)} />
                  </div>
                ))}
              </div>
            </Tile>
          )}

          {model.ratingMeans.length > 0 && (
            <Tile
              label="Rated areas"
              note={`Mean of ${
                data.referee_count === 1 ? 'the one referee’s' : 'all referees’'
              } ratings.`}
            >
              <div className="flex flex-col" style={{ gap: 9 }}>
                {model.ratingMeans.map((r) => (
                  <div key={r.question.id} className="flex items-center justify-between" style={{ gap: 9 }}>
                    <span
                      className="font-inter"
                      style={{ fontSize: 11.5, color: BODY, minWidth: 0, lineHeight: 1.35 }}
                    >
                      {r.question.label}
                    </span>
                    <Pips value={r.value} />
                  </div>
                ))}
              </div>
            </Tile>
          )}

          {model.employment.length > 0 && (
            <Tile
              label="Employment, as confirmed by referees"
              span={2}
              note="Recorded exactly as each referee gave it. Small differences in start dates are normal and are not checked automatically."
            >
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                {model.employment.map((e) => (
                  <div
                    key={e.name}
                    style={{ background: '#F4F3EF', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}
                  >
                    <p className="font-inter" style={{ fontSize: 10.5, color: MUTED, marginBottom: 4 }}>
                      {e.name}
                    </p>
                    <p
                      className="font-inter"
                      style={{ fontSize: 12.5, fontWeight: 500, color: INK, lineHeight: 1.4 }}
                    >
                      {e.claim.title || '—'}
                    </p>
                    <p className="font-inter" style={{ fontSize: 11.5, color: BODY, marginTop: 2 }}>
                      {[e.claim.from, e.claim.to].filter(Boolean).join(' – ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </Tile>
          )}

          <Tile label="Coverage">
            <div className="flex flex-col" style={{ gap: 8 }}>
              {data.referees.map((r) => (
                <span key={r.id} className="inline-flex items-start" style={{ gap: 7 }}>
                  <Check size={13} color="#12B886" strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span className="font-inter" style={{ fontSize: 11.5, color: INK, lineHeight: 1.45 }}>
                    {r.relationship || 'Reference'}
                  </span>
                </span>
              ))}
              {data.outstanding > 0 && (
                <span className="inline-flex items-start" style={{ gap: 7 }}>
                  <Clock size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span className="font-inter" style={{ fontSize: 11.5, color: BODY, lineHeight: 1.45 }}>
                    {data.outstanding} more outstanding
                  </span>
                </span>
              )}
            </div>
          </Tile>
        </div>
      </div>

      {/* ------------------------------------------------ the references in full */}
      <div style={{ marginTop: 26 }}>
        <SectionHead
          title="The references in full"
          note="Answers appear exactly as each referee wrote them — nothing edited or summarised."
        />

        {data.referees.map((r) => {
          const score = numeric(model.answerOf(r, model.recQ?.id))
          const scored = [
            ...model.ratings.map((q) => ({ q, label: q.label })),
            ...(model.rehireQ ? [{ q: model.rehireQ, label: 'Would rehire' }] : []),
            ...model.factual.map((q) => ({ q, label: q.label })),
          ]
          return (
            <section
              key={r.id}
              className="report-referee"
              style={{
                border: '1px solid #ECE7DD',
                borderRadius: 18,
                background: '#fff',
                overflow: 'hidden',
                marginTop: 14,
              }}
            >
              <header
                className="flex items-center"
                style={{
                  gap: 13,
                  padding: '16px 20px',
                  background: '#FAF8F3',
                  borderBottom: '1px solid #ECE7DD',
                }}
              >
                <span
                  className="font-poppins inline-flex items-center justify-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    background: '#6F3FF5',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {r.name.slice(0, 1).toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span
                      className="font-poppins"
                      style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.025em', color: '#0d0d09' }}
                    >
                      {r.name}
                    </span>
                    {r.relationship && (
                      <span
                        className="inline-flex font-inter"
                        style={{
                          padding: '2px 9px',
                          borderRadius: 999,
                          lineHeight: 1.45,
                          fontSize: 11,
                          background: '#EDE4FF',
                          border: '1px solid #D7C5FB',
                          color: '#5B21B6',
                        }}
                      >
                        {r.relationship}
                      </span>
                    )}
                  </div>
                  {(r.title || r.company) && (
                    <p className="font-inter" style={{ fontSize: 12, color: BODY, marginTop: 2 }}>
                      {[r.title, r.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end" style={{ gap: 2, flexShrink: 0 }}>
                  {score !== null && <ScoreNumeral value={score} />}
                  <span className="font-inter" style={{ fontSize: 10.5, color: MUTED }}>
                    Submitted {fmtDate(r.submitted_at)}
                  </span>
                </div>
              </header>

              <div style={{ padding: '16px 20px 18px' }}>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '0 22px' }}
                >
                  {scored.map(({ q, label }) => {
                    const value = model.answerOf(r, q.id)
                    const multi = q.type === 'multi_select'
                    return (
                      <div
                        key={q.id}
                        className="flex justify-between"
                        style={{
                          gap: 14,
                          padding: '9px 0',
                          borderBottom: '1px solid #F1F0EC',
                          alignItems: multi ? 'flex-start' : 'center',
                          minWidth: 0,
                        }}
                      >
                        <span
                          className="font-inter"
                          style={{
                            fontSize: 12,
                            color: BODY,
                            lineHeight: 1.4,
                            minWidth: 0,
                            paddingTop: multi ? 3 : undefined,
                          }}
                        >
                          {label}
                        </span>
                        <span style={{ textAlign: 'right', minWidth: 0 }}>
                          <ReportAnswer type={q.type} value={value} unit={q.unit} />
                        </span>
                      </div>
                    )
                  })}
                </div>

                {model.longText.length > 0 && (
                  <div className="flex flex-col" style={{ marginTop: 18, gap: 16 }}>
                    {model.longText.map((q) => {
                      const value = model.answerOf(r, q.id)
                      return (
                        <div key={q.id}>
                          <p
                            className="font-inter"
                            style={{ fontSize: 11.5, color: MUTED, marginBottom: 6, lineHeight: 1.45 }}
                          >
                            {q.label}
                          </p>
                          {isEmptyValue(value) ? (
                            <p className="font-inter" style={{ fontSize: 12.5, color: MUTED }}>
                              Not answered
                            </p>
                          ) : (
                            <p
                              className="font-inter"
                              style={{
                                borderLeft: '2px solid #D7C5FB',
                                paddingLeft: 14,
                                fontSize: 14,
                                color: INK,
                                lineHeight: 1.7,
                                textWrap: 'pretty',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {String(value)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* ----------------------------------------------------------- outstanding */}
      {data.outstanding > 0 && (
        <div
          className="flex"
          style={{
            marginTop: 14,
            gap: 11,
            padding: '15px 18px',
            border: '1px dashed #ECE7DD',
            borderRadius: 16,
            background: '#FAF8F3',
          }}
        >
          <Clock size={16} color={MUTED} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <p className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}>
              {data.outstanding === 1
                ? 'One more reference is outstanding'
                : `${data.outstanding} more references are outstanding`}
            </p>
            <p className="font-inter" style={{ fontSize: 12, color: BODY, lineHeight: 1.55, marginTop: 3 }}>
              This page updates on its own when {data.outstanding === 1 ? 'it arrives' : 'they arrive'} — the
              link stays the same. {agency} will let you know if {plural.includes('is') ? 'it is' : 'they are'} not
              going to come.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ about this report */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #F1F0EC' }}>
        <p
          className="font-poppins"
          style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09', marginBottom: 9 }}
        >
          About this report
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px 22px' }}>
          {[
            {
              icon: <MessageSquareQuote size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />,
              text: 'Referees answered a written questionnaire themselves. Nothing here is paraphrased.',
            },
            {
              icon: <Briefcase size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />,
              text:
                'Employment details are recorded as given by the referee, not verified against payroll.',
            },
            {
              icon: <EyeOff size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />,
              text: 'The candidate cannot see these answers, and never will.',
            },
            {
              icon: <Lock size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />,
              text: 'Confidential to your hiring team. Please do not forward this link.',
            },
          ].map((item, i) => (
            <div key={i} className="flex" style={{ gap: 8 }}>
              {item.icon}
              <span className="font-inter" style={{ fontSize: 11.5, color: BODY, lineHeight: 1.55 }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        <div
          className="flex"
          style={{
            marginTop: 16,
            padding: '12px 14px',
            background: '#FAF8F3',
            border: '1px solid #ECE7DD',
            borderRadius: 12,
            gap: 9,
          }}
        >
          <Mail size={14} color={MUTED} style={{ flexShrink: 0, marginTop: 1 }} />
          <span className="font-inter" style={{ fontSize: 11.5, color: BODY, lineHeight: 1.55 }}>
            Something look wrong, or want to talk it through? Reply to {firstName(data.recruiter_name)}
            {data.recruiter_email ? (
              <>
                {' at '}
                <a
                  href={`mailto:${data.recruiter_email}`}
                  style={{ color: INK, fontWeight: 600, textDecoration: 'none' }}
                >
                  {data.recruiter_email}
                </a>
              </>
            ) : (
              ` at ${agency}`
            )}
            .
          </span>
        </div>
      </div>

      {/* Print: the same document, minus the interactive controls, stamped. */}
      <style>{`
        @media print {
          .report-no-print, footer a { display: none !important; }
          .report-referee { break-inside: avoid; }
          body::after {
            content: "Confidential · ${data.candidate_name} · Prepared for ${data.client_name} · ${fmtDate(
              data.report_date,
            )}";
            position: fixed; bottom: 6px; left: 0; right: 0;
            font-family: Inter, sans-serif; font-size: 8pt; color: #8B8F9E; text-align: center;
          }
        }
      `}</style>
    </PublicPageShell>
  )
}
