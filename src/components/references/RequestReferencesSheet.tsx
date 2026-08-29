import { useEffect, useMemo, useState } from 'react'
import { Info, Send, ShieldCheck, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { FormSection } from '@/components/references/FormSection'
import { FormSheet } from '@/components/references/FormSheet'
import { useReferenceTemplates } from '@/hooks/useReferenceTemplates'
import { useCreateReferenceRequest } from '@/hooks/useReferenceRequests'
import type { ReferenceTemplate } from '@/lib/references/templateModel'
import {
  expiryLine,
  refereeRulesLine,
  reminderLine,
  relationshipSentence,
  relationshipTarget,
  resolvePlaceholders,
  templateSummaryLine,
} from '@/lib/references/requestCopy'

interface RequestReferencesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string
  candidateName: string
  candidateEmail?: string | null
  jobId?: string | null
  jobTitle?: string | null
  clientId?: string | null
  clientName?: string | null
  stageName?: string | null
}

const COUNTS = [1, 2, 3, 4]

export function RequestReferencesSheet({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  jobTitle,
  clientId,
  clientName,
  stageName,
}: RequestReferencesSheetProps) {
  const { templates } = useReferenceTemplates()
  const createRequest = useCreateReferenceRequest()

  const [templateId, setTemplateId] = useState<string | null>(null)
  const [count, setCount] = useState<number>(2)
  const [showPreview, setShowPreview] = useState(false)

  /** Live templates only. Client templates matching this job's client sort FIRST. */
  const liveTemplates = useMemo(() => {
    const live = templates.filter((t) => t.is_live)
    const isClientMatch = (t: ReferenceTemplate) =>
      t.scope === 'client' && !!clientId && t.client_id === clientId
    return [...live].sort((a, b) => Number(isClientMatch(b)) - Number(isClientMatch(a)))
  }, [templates, clientId])

  const selected = liveTemplates.find((t) => t.id === templateId) ?? liveTemplates[0] ?? null

  useEffect(() => {
    if (!open) return
    setShowPreview(false)
    const first = liveTemplates[0] ?? null
    setTemplateId(first?.id ?? null)
    setCount(first?.min_referees ?? 2)
  }, [open, liveTemplates.length])

  const pickTemplate = (t: ReferenceTemplate) => {
    setTemplateId(t.id)
    setCount(t.min_referees || 2)
  }

  const relPrefix = relationshipSentence(selected?.relationship_rules || [])
  const relTarget = relationshipTarget(selected?.relationship_rules || [])

  const emailVars: Record<string, string | number> = {
    candidate_name: candidateName,
    candidate_first_name: candidateName.split(' ')[0] || candidateName,
    job_title: jobTitle || '',
    client_name: clientName || '',
    company_name: clientName || '',
    referee_count: count,
    count,
  }

  const subject = resolvePlaceholders(selected?.candidate_email?.subject || '', emailVars)
  const body = resolvePlaceholders(selected?.candidate_email?.body || '', emailVars)

  const handleSend = async () => {
    if (!selected) return
    await createRequest.mutateAsync({
      candidateId,
      template: selected,
      minRefereesOverride: count,
      jobId,
      clientId,
      stage: stageName,
    })
    onOpenChange(false)
  }

  const isClientMatch = (t: ReferenceTemplate) =>
    t.scope === 'client' && !!clientId && t.client_id === clientId

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      eyebrow={[candidateName, jobTitle].filter(Boolean).join(' · ')}
      title="Request references"
      subtitle="The candidate submits their referees, then each referee is emailed their own private questionnaire."
      footer={
        <>
          <span
            className="font-inter inline-flex items-center"
            style={{ fontSize: 11.5, color: '#8B8F9E', gap: 6 }}
          >
            <Info size={13} />
            References never block a stage change or an offer.
          </span>
          <span style={{ marginLeft: 'auto' }} className="flex items-center gap-2.5">
            <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" icon={Send} onClick={handleSend}>
              Send to candidate
            </Button>
          </span>
        </>
      }
    >
      {/* BLOCK 1 — Template */}
      <FormSection
        title="Template"
        subtitle={
          clientName
            ? `Client templates for ${clientName} are offered first.`
            : 'Live templates only.'
        }
      >
        {liveTemplates.length === 0 ? (
          <p className="font-inter" style={{ fontSize: 12, color: '#8B8F9E' }}>
            No live templates yet.
          </p>
        ) : (
          liveTemplates.map((t, i) => {
            const isSel = selected?.id === t.id
            return (
              <div
                key={t.id}
                role="radio"
                aria-checked={isSel}
                tabIndex={0}
                onClick={() => pickTemplate(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pickTemplate(t)
                  }
                }}
                className="flex items-center"
                style={{
                  gap: 11,
                  padding: '11px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  marginBottom: i === liveTemplates.length - 1 ? 0 : 6,
                  border: `1px solid ${isSel ? '#D7C5FB' : '#F1F0EC'}`,
                  background: isSel ? '#FAF8FF' : '#fff',
                }}
              >
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: `1.5px solid ${isSel ? '#6F3FF5' : '#D1D0CB'}`,
                  }}
                >
                  {isSel && (
                    <span
                      style={{ width: 8, height: 8, borderRadius: 999, background: '#6F3FF5' }}
                    />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center" style={{ gap: 7 }}>
                    <span
                      className="font-poppins truncate"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#1F2230',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {t.name}
                    </span>
                    {isClientMatch(t) && (
                      <Badge tone="blue" size="xs">
                        Client match
                      </Badge>
                    )}
                  </div>
                  <p
                    className="font-inter"
                    style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}
                  >
                    {templateSummaryLine(t)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </FormSection>

      {/* BLOCK 2 — Referee requirements */}
      <FormSection
        title="Referee requirements"
        subtitle={`Overrides for this candidate only. The template default is ${
          selected?.min_referees ?? 2
        }–${selected?.max_referees ?? 3}.`}
        action={
          <Badge tone="neutral" size="xs">
            This request only
          </Badge>
        }
      >
        <FormField label="How many referees?">
          <div className="flex" style={{ gap: 7 }}>
            {COUNTS.map((n) => {
              const isSel = count === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className="font-poppins"
                  style={{
                    width: 36,
                    height: 34,
                    borderRadius: 8,
                    border: `1px solid ${isSel ? '#0d0d09' : '#E0DDD3'}`,
                    background: isSel ? '#0d0d09' : '#fff',
                    color: isSel ? '#fffcf9' : '#5A6072',
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </FormField>

        {relPrefix && relTarget && (
          <div
            className="flex items-center"
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #F6F5F1',
              gap: 10,
            }}
          >
            <ShieldCheck size={14} color="#12B886" />
            <span className="font-inter flex-1" style={{ fontSize: 12, color: '#1F2230' }}>
              {relPrefix}
              <strong style={{ fontWeight: 600 }}>{relTarget}</strong>
            </span>
            <Badge tone="neutral" size="xs">
              From template
            </Badge>
          </div>
        )}
      </FormSection>

      {/* BLOCK 3 — Candidate email */}
      <FormSection
        title="Candidate email"
        action={
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="font-inter"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#6F3FF5',
              fontWeight: 600,
              fontSize: 11.5,
            }}
          >
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
        }
      >
        {showPreview ? (
          <div
            className="font-inter"
            style={{ fontSize: 12.5, color: '#1F2230', lineHeight: 1.75 }}
          >
            <p style={{ marginBottom: 10 }}>
              Hi {candidateName.split(' ')[0] || candidateName},
            </p>
            <p style={{ marginBottom: 10 }}>
              {body ||
                `We're at the reference stage for ${jobTitle || 'this role'}. Please share the details of ${count} ${
                  count === 1 ? 'referee' : 'referees'
                } so we can contact them directly.`}
            </p>
            <p style={{ marginBottom: 12 }}>
              We need <strong style={{ fontWeight: 600 }}>{count}</strong>{' '}
              {count === 1 ? 'referee' : 'referees'}
              {relTarget ? `, at least one a ${relTarget}` : ''}.
            </p>
            <span
              className="font-poppins"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                background: '#0d0d09',
                color: '#fffcf9',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              Add my referees
            </span>
          </div>
        ) : (
          <div>
            {[
              { k: 'To', v: candidateEmail || '—' },
              { k: 'Subject', v: subject || 'Reference check' },
              { k: 'Link expires', v: expiryLine(selected?.candidate_link_days) },
              { k: 'Reminders', v: reminderLine(selected) },
            ].map((row) => (
              <div
                key={row.k}
                className="flex items-baseline justify-between"
                style={{ gap: 14, padding: '7px 0' }}
              >
                <span className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
                  {row.k}
                </span>
                <span
                  className="font-inter text-right"
                  style={{ fontSize: 12, fontWeight: 500, color: '#1F2230' }}
                >
                  {row.v}
                </span>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* BLOCK 4 — Ownership callout */}
      <div
        className="flex"
        style={{
          gap: 9,
          padding: '11px 13px',
          background: '#FAFAF7',
          border: '1px solid #E7E8EE',
          borderRadius: 10,
          fontSize: 11.5,
          color: '#5A6072',
          lineHeight: 1.55,
        }}
      >
        <UserRound size={14} color="#8B8F9E" className="shrink-0" style={{ marginTop: 1 }} />
        <span className="font-inter">
          This check belongs to{' '}
          <strong style={{ fontWeight: 600, color: '#1F2230' }}>{candidateName}</strong>, not to
          the job. It will be visible on every job they're associated with, stamped with the
          context it was collected in — {[clientName, jobTitle, stageName].filter(Boolean).join(' · ')}.
        </span>
      </div>
    </FormSheet>
  )
}

export default RequestReferencesSheet
