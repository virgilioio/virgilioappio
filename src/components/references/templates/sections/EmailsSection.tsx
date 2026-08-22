import { useRef, useState } from 'react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubjectTemplateEditor, BodyTemplateEditor } from '@/components/editors'
import type {
  SubjectTemplateEditorHandle,
} from '@/components/editors/SubjectTemplateEditor'
import type { BodyTemplateEditorHandle } from '@/components/editors/BodyTemplateEditor'
import { FormField } from '@/components/ui/form-field'
import { PlaceholderPill } from '@/components/references/PlaceholderPill'
import { SectionHead } from '../rowKit'
import {
  CANDIDATE_PLACEHOLDERS,
  PREVIEW_CTA,
  PREVIEW_RECIPIENTS,
  REFEREE_PLACEHOLDERS,
  renderPlaceholders,
  type RefEmail,
} from '@/lib/references/templateModel'

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'

function PlaceholderPills({
  keys,
  onInsert,
}: {
  keys: readonly string[]
  onInsert: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap" style={{ gap: 5 }}>
      {keys.map((k) => (
        <PlaceholderPill key={k} name={k} onClick={() => onInsert(k)} title={`Insert {{${k}}}`} />
      ))}
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
  audience: 'candidate' | 'referee'
}) {
  const subjectRef = useRef<SubjectTemplateEditorHandle>(null)
  const bodyRef = useRef<BodyTemplateEditorHandle>(null)
  const [focused, setFocused] = useState<'subject' | 'body'>('body')

  const insert = (key: string) => {
    if (focused === 'subject') subjectRef.current?.insertPlaceholder(key)
    else bodyRef.current?.insertPlaceholder(key)
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,0.85fr)' }}>
      <div className="space-y-3">
        <FormField label="Subject">
          <SubjectTemplateEditor
            ref={subjectRef}
            value={value.subject}
            onChange={(v) => onChange({ subject: v })}
            onFocus={() => setFocused('subject')}
            placeholder="Subject line"
          />
        </FormField>

        <FormField label="Body">
          <BodyTemplateEditor
            ref={bodyRef}
            value={value.body}
            onChange={(v) => onChange({ body: v })}
            onFocus={() => setFocused('body')}
            minHeight="220px"
            placeholder="Email body"
          />
        </FormField>

        <div>
          <p className="font-inter font-medium text-[#1F2230] mb-1.5" style={{ fontSize: 12 }}>
            Placeholders
          </p>
          <PlaceholderPills keys={placeholders} onInsert={insert} />
          <p className="mt-1.5 font-inter" style={{ fontSize: 11, color: MUTED }}>
            Click a placeholder to insert it where your cursor is.
          </p>
        </div>
      </div>

      <div
        className="rounded-xl bg-[#F6F5F1] p-3.5"
        style={{ border: `1px solid ${HAIRLINE}`, alignSelf: 'start' }}
      >
        <p
          className="font-inter font-semibold uppercase mb-2"
          style={{ fontSize: 10, letterSpacing: '0.06em', color: MUTED }}
        >
          Preview · sample values
        </p>
        <div className="rounded-lg bg-[#fffcf9]" style={{ border: `1px solid ${HAIRLINE}` }}>
          <div
            className="flex items-center justify-between gap-2 px-3 py-2"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <span className="font-inter truncate" style={{ fontSize: 11, color: MUTED }}>
              To {PREVIEW_RECIPIENTS[audience]}
            </span>
            <span className="font-inter" style={{ fontSize: 11, color: MUTED }}>
              Gio
            </span>
          </div>
          <div className="p-3">
            <p
              className="font-poppins font-semibold text-[#0d0d09] mb-2"
              style={{ fontSize: 13, letterSpacing: '-0.01em' }}
            >
              {renderPlaceholders(value.subject) || 'No subject'}
            </p>
            <div
              className="font-inter text-[12.5px] text-[#1F2230] leading-relaxed whitespace-pre-wrap [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: renderPlaceholders(value.body) }}
            />
            <span
              className="inline-flex items-center justify-center font-poppins font-medium"
              style={{
                marginTop: 12,
                height: 34,
                padding: '0 14px',
                borderRadius: 8,
                background: '#0d0d09',
                color: '#fffcf9',
                fontSize: 12.5,
                letterSpacing: '-0.005em',
              }}
            >
              {PREVIEW_CTA[audience]}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmailsSection({
  candidateEmail,
  refereeEmail,
  onChange,
}: {
  candidateEmail: RefEmail
  refereeEmail: RefEmail
  onChange: (patch: { candidate_email?: RefEmail; referee_email?: RefEmail }) => void
}) {
  const [tab, setTab] = useState<'candidate' | 'referee'>('candidate')

  return (
    <div className="space-y-4">
      <SectionHead
        title="Emails"
        subtitle="The two messages this template sends — one to the candidate, one to each referee."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'candidate' | 'referee')}>
        <TabsList>
          <TabsTrigger value="candidate">Candidate email</TabsTrigger>
          <TabsTrigger value="referee">Referee email</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'candidate' ? (
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
