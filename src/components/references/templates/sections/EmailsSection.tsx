import { useRef, useState } from 'react'
import { UserRound, Users } from 'lucide-react'

import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors'
import type { SubjectTemplateEditorHandle } from '@/components/editors/SubjectTemplateEditor'
import type { BodyTemplateEditorHandle } from '@/components/editors/BodyTemplateEditor'
import { FormField } from '@/components/ui/form-field'
import { PlaceholderPill } from '@/components/references/PlaceholderPill'
import { SectionCard, SectionHead } from '../rowKit'
import {
  CANDIDATE_PLACEHOLDERS,
  PREVIEW_CTA,
  PREVIEW_RECIPIENTS,
  REFEREE_PLACEHOLDERS,
  renderPlaceholders,
  type RefEmail,
} from '@/lib/references/templateModel'

const MUTED = '#8B8F9E'

type Audience = 'candidate' | 'referee'

const COPY: Record<Audience, { title: string; subtitle: string }> = {
  candidate: {
    title: 'Candidate email',
    subtitle: 'Sent when a recruiter triggers the check.',
  },
  referee: {
    title: 'Referee email',
    subtitle: 'Sent to each referee the candidate submits.',
  },
}

/** Segmented audience switcher — 4px inset track, white active pill. */
function AudienceSwitcher({
  value,
  onChange,
}: {
  value: Audience
  onChange: (v: Audience) => void
}) {
  const options: { id: Audience; label: string; icon: typeof UserRound }[] = [
    { id: 'candidate', label: 'Candidate email', icon: UserRound },
    { id: 'referee', label: 'Referee email', icon: Users },
  ]

  return (
    <div
      className="inline-flex"
      style={{ gap: 4, padding: 4, background: '#F1F0EC', borderRadius: 10, marginBottom: 14 }}
    >
      {options.map((o) => {
        const active = o.id === value
        const Icon = o.icon
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="inline-flex items-center font-poppins"
            style={{
              gap: 7,
              padding: '7px 13px',
              borderRadius: 7,
              border: 'none',
              fontSize: 12,
              letterSpacing: '-0.01em',
              fontWeight: active ? 600 : 500,
              color: active ? '#1F2230' : '#5A6072',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(13,13,9,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            <Icon size={13} strokeWidth={2} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function EmailPreview({ value, audience }: { value: RefEmail; audience: Audience }) {
  return (
    <div>
      <p
        className="font-inter uppercase"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: MUTED,
          letterSpacing: '0.07em',
          marginBottom: 8,
        }}
      >
        Preview
      </p>
      <div
        style={{
          background: '#fff',
          border: '1px solid #E7E8EE',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
        }}
      >
        <div
          style={{ padding: '10px 14px', background: '#FAFAF7', borderBottom: '1px solid #F1F0EC' }}
        >
          <p className="font-inter truncate" style={{ fontSize: 11, color: MUTED }}>
            To: {PREVIEW_RECIPIENTS[audience]}
          </p>
          <p
            className="font-inter"
            style={{ fontSize: 12, fontWeight: 600, color: '#1F2230', marginTop: 3 }}
          >
            {renderPlaceholders(value.subject) || 'No subject'}
          </p>
        </div>

        <div style={{ padding: 14 }}>
          <div
            className="font-inter [&_p]:mb-2 whitespace-pre-wrap"
            style={{ fontSize: 12, color: '#1F2230', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: renderPlaceholders(value.body) }}
          />
          <span
            className="inline-flex items-center font-poppins"
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 8,
              background: '#0d0d09',
              color: '#fffcf9',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              margin: '4px 0',
            }}
          >
            {PREVIEW_CTA[audience]}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmailPane({
  value,
  onChange,
  placeholders,
  audience,
}: {
  value: RefEmail
  onChange: (patch: Partial<RefEmail>) => void
  placeholders: readonly string[]
  audience: Audience
}) {
  const subjectRef = useRef<SubjectTemplateEditorHandle>(null)
  const bodyRef = useRef<BodyTemplateEditorHandle>(null)
  const [focused, setFocused] = useState<'subject' | 'body'>('body')

  const insert = (key: string) => {
    if (focused === 'subject') subjectRef.current?.insertPlaceholder(key)
    else bodyRef.current?.insertPlaceholder(key)
  }

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}
    >
      <SectionCard>
        <SectionHead title={COPY[audience].title} subtitle={COPY[audience].subtitle} />

        <FormField label="Subject" required>
          <SubjectTemplateEditor
            ref={subjectRef}
            value={value.subject}
            onChange={(v) => onChange({ subject: v })}
            onFocus={() => setFocused('subject')}
            placeholder="Subject line"
          />
        </FormField>

        <div style={{ height: 12 }} />

        <FormField
          label="Body"
          required
          helpText="Click a placeholder below to insert it at the cursor."
        >
          <BodyTemplateEditor
            ref={bodyRef}
            value={value.body}
            onChange={(v) => onChange({ body: v })}
            onFocus={() => setFocused('body')}
            minHeight="220px"
            placeholder="Email body"
          />
        </FormField>

        <div className="flex flex-wrap" style={{ gap: 5, marginTop: 10 }}>
          {placeholders.map((k) => (
            <PlaceholderPill
              key={k}
              name={k}
              onClick={() => insert(k)}
              title={`Insert {{${k}}}`}
            />
          ))}
        </div>
      </SectionCard>

      <EmailPreview value={value} audience={audience} />
    </div>
  )
}

export function EmailsSection({
  candidateEmail,
  refereeEmail,
  onChange,
}: {
  candidateEmail: RefEmail
  refereeEmail: RefEmail
  onChange: (patch: { candidate_email?: RefEmail; referee_email?: RefEmail }) => void
}) {
  const [audience, setAudience] = useState<Audience>('candidate')

  return (
    <div>
      <AudienceSwitcher value={audience} onChange={setAudience} />

      {audience === 'candidate' ? (
        <EmailPane
          value={candidateEmail}
          audience="candidate"
          placeholders={CANDIDATE_PLACEHOLDERS}
          onChange={(patch) => onChange({ candidate_email: { ...candidateEmail, ...patch } })}
        />
      ) : (
        <EmailPane
          value={refereeEmail}
          audience="referee"
          placeholders={REFEREE_PLACEHOLDERS}
          onChange={(patch) => onChange({ referee_email: { ...refereeEmail, ...patch } })}
        />
      )}
    </div>
  )
}
