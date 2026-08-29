/**
 * Flow C — the candidate adds their referees. Token-resolved, no Gio account.
 * Route: /references/:token
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Loader2, Plus, Send, Trash2 } from 'lucide-react'

import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PublicField, PublicInput, PublicPhoneField, PublicSelect } from '@/components/public/PublicField'
import { QuestionInstrument } from '@/components/public/QuestionInstrument'
import { TerminalCard } from '@/components/public/TerminalCard'
import {
  resolveCandidateToken,
  submitCandidateReferees,
  type CandidateResolve,
  type PublicRefereeField,
} from '@/lib/references/publicApi'

interface RefereeDraft {
  key: string
  values: Record<string, string>
  on_hold: boolean
  hold_note: string
}

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
const word = (n: number) => NUMBER_WORD[n] ?? String(n)

const newReferee = (): RefereeDraft => ({
  key: Math.random().toString(36).slice(2),
  values: {},
  on_hold: false,
  hold_note: '',
})

function fieldLabel(f: PublicRefereeField) {
  return f.key === 'relationship' ? 'Relationship to you' : f.label
}

function formatDate(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`
}

export default function PublicReferenceSubmit() {
  const { token = '' } = useParams()
  const [data, setData] = useState<CandidateResolve | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [referees, setReferees] = useState<RefereeDraft[]>([])
  const [consent, setConsent] = useState(false)
  const [selfAnswers, setSelfAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ emailed: string[]; held: string[] } | null>(null)

  useEffect(() => {
    let alive = true
    resolveCandidateToken(token)
      .then((d) => {
        if (!alive) return
        setData(d)
        setReferees(
          Array.from({ length: Math.max(1, d.referee_count) }, () => newReferee()),
        )
        document.title = `Add your references · ${d.brand.agency_name}`
      })
      .catch(() => alive && setLoadError('expired'))
    return () => {
      alive = false
    }
  }, [token])

  const fields = data?.referee_fields ?? []
  const contactable = referees.filter((r) => !r.on_hold)
  const heldCount = referees.length - contactable.length

  const requiredOk = (r: RefereeDraft) =>
    fields.every((f) => !f.required || (r.values[f.key] ?? '').trim().length > 0)

  const relationshipRule = data?.relationship_rules?.find((r) => r.relationship) ?? null
  const relationshipMet = useMemo(() => {
    if (!relationshipRule) return true
    const need = relationshipRule.count || 1
    const have = contactable.filter(
      (r) =>
        (r.values.relationship ?? '').toLowerCase() ===
        relationshipRule.relationship.toLowerCase(),
    ).length
    return have >= need
  }, [contactable, relationshipRule])

  const selfRequiredIds = (data?.self_assessment_questions ?? [])
    .filter((q) => q.required)
    .map((q) => q.id)
  const selfDone = selfRequiredIds.every((id) => {
    const v = selfAnswers[id]
    return v !== undefined && v !== null && v !== ''
  })

  const checklist = useMemo(() => {
    if (!data) return []
    const items = [
      {
        label: `${word(data.referee_count)} contactable ${
          data.referee_count === 1 ? 'referee' : 'referees'
        } added`,
        ok: contactable.length >= data.referee_count,
      },
      {
        label: 'Every required detail filled in',
        ok: referees.length > 0 && referees.every(requiredOk),
      },
    ]
    if (relationshipRule) {
      items.push({
        label: `At least ${word(relationshipRule.count || 1)} ${relationshipRule.relationship.toLowerCase()}`,
        ok: relationshipMet,
      })
    }
    if (selfRequiredIds.length > 0) {
      items.push({ label: 'Your own answers completed', ok: selfDone })
    }
    items.push({ label: 'Permission confirmed', ok: consent })
    return items
  }, [data, referees, contactable.length, relationshipRule, relationshipMet, selfDone, consent])

  const canSubmit = checklist.length > 0 && checklist.every((c) => c.ok) && !submitting

  const patch = (key: string, next: Partial<RefereeDraft>) =>
    setReferees((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)))

  const handleSubmit = async () => {
    if (!data || !canSubmit) return
    setSubmitting(true)
    try {
      const result = await submitCandidateReferees(token, {
        consent: true,
        self_assessment: selfAnswers,
        referees: referees.map((r) => ({
          ...r.values,
          on_hold: r.on_hold,
          hold_note: r.on_hold ? r.hold_note : null,
        })),
      })
      setDone({ emailed: result.emailed, held: result.held })
    } catch {
      setLoadError('failed')
    } finally {
      setSubmitting(false)
    }
  }

  /* ------------------------------------------------------------- shell states */
  if (loadError === 'expired' || (!data && loadError)) {
    return (
      <PublicPageShell agencyName="References" pageKind="Reference check" width={760}>
        <TerminalCard
          tone="neutral"
          title="This link has expired"
          body="Reference links are time-limited for privacy. Please ask the recruiter who contacted you for a fresh link."
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
      pageKind="Reference check"
      width={760}
    >
      {children}
    </PublicPageShell>
  )

  if (done) {
    return shell(
      <TerminalCard
        tone="green"
        title="References received"
        body={
          <>
            {done.emailed.length > 0 && (
              <p style={{ margin: 0 }}>
                We’ve emailed {done.emailed.join(', ')} their own private questionnaire.
              </p>
            )}
            {done.held.length > 0 && (
              <p style={{ marginTop: 8 }}>
                {done.held.join(', ')} {done.held.length === 1 ? 'is' : 'are'} on hold and will not
                be contacted yet.
              </p>
            )}
          </>
        }
        foot={`Any questions? Reply to the email from ${data.recruiter_name}.`}
      />,
    )
  }

  if (data.status === 'cancelled') {
    return shell(
      <TerminalCard
        tone="neutral"
        title="This request was withdrawn"
        body="Nothing further is needed from you. You can close this page."
      />,
    )
  }

  if (data.status === 'already_submitted') {
    return shell(
      <TerminalCard
        tone="green"
        title="You’ve already submitted these"
        body={
          data.submitted_referees.length > 0 ? (
            <>
              We have {data.submitted_referees.map((r) => r.name).join(', ')} on file. There’s
              nothing else to do here.
            </>
          ) : (
            'There’s nothing else to do here.'
          )
        }
      />,
    )
  }

  /* -------------------------------------------------------------------- form */
  return shell(
    <>
      {/* Header block */}
      <p
        className="font-inter"
        style={{ fontSize: 11.5, fontWeight: 600, color: '#6F3FF5', letterSpacing: '0.02em' }}
      >
        {[data.client_name, data.job_title].filter(Boolean).join(' · ')}
      </p>
      <h1
        className="font-poppins"
        style={{
          fontSize: 25,
          fontWeight: 600,
          letterSpacing: '-0.04em',
          color: '#1F2230',
          marginTop: 8,
        }}
      >
        Add {word(data.referee_count)} references
        <span style={{ color: '#6F3FF5' }}>.</span>
      </h1>
      <p
        className="font-inter"
        style={{ fontSize: 13.5, lineHeight: 1.65, color: '#5A6072', marginTop: 8 }}
      >
        Each person you add gets their own short, private questionnaire. Their answers go to the
        hiring team — never back to you. You can flag anyone we shouldn’t contact yet.
      </p>
      {data.expires_at && (
        <span
          className="font-inter inline-block"
          style={{
            marginTop: 12,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#F4F3EE',
            color: '#5A6072',
            fontSize: 11.5,
          }}
        >
          This link expires {formatDate(data.expires_at)}
        </span>
      )}

      {/* Checklist */}
      <div
        style={{
          marginTop: 22,
          padding: '14px 16px',
          borderRadius: 12,
          background: '#FAF8FF',
          border: '1px solid #EDE4FF',
        }}
      >
        <p
          className="font-poppins"
          style={{ fontSize: 11.5, fontWeight: 600, color: '#4B22B8', letterSpacing: '0.04em' }}
        >
          BEFORE YOU START
        </p>
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
          {checklist.map((item) => (
            <li
              key={item.label}
              className="font-inter flex items-center"
              style={{ gap: 9, fontSize: 12.5, color: item.ok ? '#1F2230' : '#8B8F9E', padding: '3px 0' }}
            >
              <span
                className="inline-flex items-center justify-center shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  border: `1.5px solid ${item.ok ? '#0E9F6E' : '#D1D0CB'}`,
                  background: item.ok ? '#0E9F6E' : 'transparent',
                  color: '#fff',
                }}
              >
                {item.ok && <Check size={10} strokeWidth={3} />}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Self-assessment */}
      {data.self_assessment_questions.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2
            className="font-poppins"
            style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: '#1F2230' }}
          >
            Your own answers
          </h2>
          <p className="font-inter" style={{ fontSize: 12.5, color: '#8B8F9E', marginTop: 4 }}>
            The same questions your referees will see, about yourself.
          </p>
          <div style={{ marginTop: 14 }}>
            {data.self_assessment_questions.map((q, i) => (
              <div
                key={q.id}
                style={{
                  padding: '14px 0',
                  borderTop: i === 0 ? 'none' : '1px solid #F6F5F1',
                }}
              >
                <p
                  className="font-poppins"
                  style={{ fontSize: 14, fontWeight: 600, color: '#1F2230', letterSpacing: '-0.01em' }}
                >
                  {q.label}
                </p>
                <div style={{ marginTop: 10 }}>
                  <QuestionInstrument
                    question={q}
                    value={selfAnswers[q.id]}
                    onChange={(v) => setSelfAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    showRatingLegend={i === 0}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Referee cards */}
      <section style={{ marginTop: 26 }}>
        <h2
          className="font-poppins"
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: '#1F2230' }}
        >
          Your referees
        </h2>

        {referees.map((r, i) => (
          <div
            key={r.key}
            style={{
              marginTop: 14,
              padding: '16px 16px 14px',
              borderRadius: 14,
              border: `1px solid ${r.on_hold ? '#F5D9AE' : '#EDEBE3'}`,
              background: r.on_hold ? '#FEFAF3' : '#fff',
            }}
          >
            <div className="flex items-center" style={{ gap: 9 }}>
              <span
                className="font-poppins inline-flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: '#F1F0EC',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#5A6072',
                }}
              >
                {i + 1}
              </span>
              <span
                className="font-poppins"
                style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2230' }}
              >
                Referee {i + 1}
              </span>
              {r.on_hold && (
                <span
                  className="font-inter"
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: '#FEF4E6',
                    color: '#B25309',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  Won’t be contacted yet
                </span>
              )}
              {referees.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReferees((prev) => prev.filter((x) => x.key !== r.key))}
                  className="font-inter inline-flex items-center"
                  style={{
                    marginLeft: 'auto',
                    gap: 5,
                    border: 'none',
                    background: 'transparent',
                    color: '#8B8F9E',
                    fontSize: 11.5,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              )}
            </div>

            <div
              className="grid"
              style={{
                marginTop: 12,
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              }}
            >
              {fields.map((f) => (
                <PublicField
                  key={f.id ?? f.key}
                  label={fieldLabel(f)}
                  required={f.required}
                  helper={f.helper}
                >
                  <RefereeFieldControl
                    field={f}
                    value={r.values[f.key] ?? ''}
                    onChange={(v) => patch(r.key, { values: { ...r.values, [f.key]: v } })}
                  />
                </PublicField>
              ))}

            </div>

            <div
              className="flex items-center"
              style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F6F5F1', gap: 10 }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={r.on_hold}
                onClick={() => patch(r.key, { on_hold: !r.on_hold })}
                style={{
                  width: 34,
                  height: 20,
                  borderRadius: 999,
                  border: 'none',
                  padding: 2,
                  background: r.on_hold ? '#E8590C' : '#DAD8D0',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  justifyContent: r.on_hold ? 'flex-end' : 'flex-start',
                }}
              >
                <span
                  style={{ width: 16, height: 16, borderRadius: 999, background: '#fff' }}
                  aria-hidden
                />
              </button>
              <span className="font-inter" style={{ fontSize: 12.5, color: '#1F2230' }}>
                Don’t contact yet
              </span>
            </div>

            {r.on_hold && (
              <div style={{ marginTop: 12 }}>
                <PublicField label="Note for the recruiter (optional)">
                  <PublicInput
                    value={r.hold_note}
                    onChange={(e) => patch(r.key, { hold_note: e.target.value })}
                    placeholder="e.g. current manager — please wait until I’ve resigned"
                  />
                </PublicField>
              </div>
            )}
          </div>
        ))}

        {referees.length < (data.max_referees || 8) && (
          <button
            type="button"
            onClick={() => setReferees((prev) => [...prev, newReferee()])}
            className="font-poppins inline-flex items-center"
            style={{
              marginTop: 14,
              gap: 7,
              height: 36,
              padding: '0 14px',
              borderRadius: 9,
              border: '1px solid #E3E0D6',
              background: '#fff',
              color: '#1F2230',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Add another referee
          </button>
        )}
      </section>

      {/* Consent */}
      <section
        style={{
          marginTop: 26,
          padding: '14px 16px',
          borderRadius: 12,
          background: '#F7F6F2',
          border: '1px solid #EDEBE3',
        }}
      >
        <label className="flex items-start" style={{ gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: '#6F3FF5' }}
          />
          <span className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.6, color: '#1F2230' }}>
            {data.consent_text ||
              'I confirm that I have asked each person listed above for their permission to be contacted as a reference, and that the details I’ve provided are accurate.'}
          </span>
        </label>
      </section>

      {/* Submit */}
      <div
        className="flex flex-wrap items-center"
        style={{ marginTop: 22, gap: 12, paddingTop: 16, borderTop: '1px solid #F1F0EC' }}
      >
        <span className="font-inter" style={{ fontSize: 12, color: '#8B8F9E' }}>
          {canSubmit
            ? `Ready to send — ${contactable.length} ${
                contactable.length === 1 ? 'referee' : 'referees'
              } will be emailed now${heldCount > 0 ? `, ${heldCount} held` : ''}.`
            : 'Complete the checklist above to send.'}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="font-poppins inline-flex items-center justify-center submit-btn"
          style={{
            marginLeft: 'auto',
            gap: 8,
            height: 44,
            padding: '0 20px',
            borderRadius: 10,
            border: 'none',
            background: canSubmit ? '#0d0d09' : '#DAD8D0',
            color: '#fffcf9',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Send to my referees
        </button>
      </div>
      <style>{`@media (max-width:759px){.submit-btn{width:100%;margin-left:0 !important;}}`}</style>
    </>,
  )
}
