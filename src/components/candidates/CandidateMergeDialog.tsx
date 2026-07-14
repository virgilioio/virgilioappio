import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Copy, X, GitMerge, Mail, Phone, MapPin, Briefcase, DollarSign, Award,
  Sparkles, Plus,
} from 'lucide-react'

interface CandidateMergeDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  existingCandidate: any
  newCandidate: any
  mergedCandidate: any
}

const hasValue = (v: any) => v !== null && v !== undefined && String(v).trim() !== ''

const displayName = (c: any) => {
  if (!c) return 'this candidate'
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.name || c.full_name || c.email || 'this candidate'
}

type CellState = 'neutral' | 'filled' | 'updated'

function fieldState(existing: any, merged: any): CellState {
  const e = hasValue(existing)
  const m = hasValue(merged)
  if (!m) return 'neutral'
  if (!e) return 'filled'
  if (String(existing).trim() !== String(merged).trim()) return 'updated'
  return 'neutral'
}

function ValueCell({
  value,
  state = 'neutral',
}: {
  value: any
  state?: CellState
}) {
  const highlighted = state !== 'neutral'
  return (
    <div
      className="flex items-center justify-between gap-2"
      style={{
        minHeight: 42,
        padding: '10px 13px',
        borderRadius: 9,
        background: highlighted ? '#F7F2FF' : '#fff',
        border: `1px solid ${highlighted ? '#DFCBFB' : '#EDECE6'}`,
        boxShadow: highlighted ? 'inset 0 0 0 1px #E7DFFB' : undefined,
      }}
    >
      {hasValue(value) ? (
        <span
          className="font-inter truncate"
          style={{
            fontSize: 12.5,
            color: highlighted ? '#5B21B6' : '#1F2230',
            fontWeight: highlighted ? 500 : 400,
          }}
        >
          {value}
        </span>
      ) : (
        <span
          className="font-inter italic truncate"
          style={{ fontSize: 12.5, color: '#A8ACB8' }}
        >
          Empty
        </span>
      )}
      {state === 'filled' && (
        <span
          className="inline-flex items-center gap-1 shrink-0"
          style={{
            background: '#EDE4FF',
            color: '#6F3FF5',
            borderRadius: 999,
            padding: '2px 7px',
            fontSize: 9.5,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Sparkles size={10} />
          Filled
        </span>
      )}
      {state === 'updated' && (
        <span
          className="inline-flex items-center gap-1 shrink-0"
          style={{
            background: '#EDE4FF',
            color: '#6F3FF5',
            borderRadius: 999,
            padding: '2px 7px',
            fontSize: 9.5,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Plus size={10} />
          Updated
        </span>
      )}
    </div>
  )
}

function FieldRow({
  icon: Icon,
  label,
  existing,
  merged,
}: {
  icon: React.ComponentType<any>
  label: string
  existing: any
  merged: any
}) {
  const state = fieldState(existing, merged)
  const differs = state !== 'neutral'
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} color="#8B8F9E" />
        <span
          className="font-inter"
          style={{ fontSize: 11.5, fontWeight: 500, color: '#5A6072' }}
        >
          {label}
        </span>
        {differs && (
          <span
            className="inline-block"
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: '#6F3FF5',
            }}
          />
        )}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <ValueCell value={existing} state="neutral" />
        <ValueCell value={merged} state={state} />
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ flexShrink: 0 }}>
      <h3
        className="font-poppins"
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: '#1F2230',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid #F1F0EC',
        }}
      >
        {title}
      </h3>
      <div className="flex flex-col" style={{ gap: 14 }}>
        {children}
      </div>
    </section>
  )
}

export function CandidateMergeDialog({
  isOpen,
  onConfirm,
  onCancel,
  existingCandidate,
  mergedCandidate,
}: CandidateMergeDialogProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  if (!isOpen || !existingCandidate || !mergedCandidate) return null

  const name = displayName(existingCandidate)

  const existingLocation = [existingCandidate.location_city, existingCandidate.location_country]
    .filter(Boolean)
    .join(', ')
  const mergedLocation = [mergedCandidate.location_city, mergedCandidate.location_country]
    .filter(Boolean)
    .join(', ')

  const existingSalary = existingCandidate.salary_amount
    ? `${existingCandidate.salary_currency || ''} ${existingCandidate.salary_amount}`.trim()
    : ''
  const mergedSalary = mergedCandidate.salary_amount
    ? `${mergedCandidate.salary_currency || ''} ${mergedCandidate.salary_amount}`.trim()
    : ''

  const existingSkills: string[] = existingCandidate.skills || []
  const mergedSkills: string[] = mergedCandidate.skills || []
  const addedSkills = mergedSkills.filter((s) => !existingSkills.includes(s))
  const skillsDiffer = addedSkills.length > 0 || existingSkills.length !== mergedSkills.length

  // Count fields that changed for header sub-line
  const fields: Array<[any, any]> = [
    [existingCandidate.email, mergedCandidate.email],
    [existingCandidate.phone, mergedCandidate.phone],
    [existingLocation, mergedLocation],
    [existingCandidate.role_current, mergedCandidate.role_current],
    [existingSalary, mergedSalary],
  ]
  let changedCount = fields.filter(([e, m]) => fieldState(e, m) !== 'neutral').length
  if (skillsDiffer) changedCount += 1

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(13,13,9,0.34)', padding: 24 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="flex flex-col bg-white"
        style={{
          width: 820,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 48px)',
          borderRadius: 18,
          boxShadow:
            '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
        }}
      >
        {/* Header */}
        <header
          className="relative"
          style={{
            padding: '20px 24px 18px',
            borderBottom: '1px solid #F1F0EC',
            flexShrink: 0,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 38,
                height: 38,
                background: '#EDE4FF',
                borderRadius: 11,
              }}
            >
              <Copy size={17} color="#6F3FF5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-inter uppercase"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  color: '#8B8F9E',
                }}
              >
                ADD CANDIDATE · MATCH FOUND
              </div>
              <h2
                className="font-poppins mt-0.5"
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  color: '#0d0d09',
                  whiteSpace: 'nowrap',
                }}
              >
                Duplicate candidate detected<span style={{ color: '#D7C5FB' }}>.</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="shrink-0 inline-flex items-center justify-center hover:bg-[#F1F0EC] transition-colors"
              style={{ width: 30, height: 30, borderRadius: 8 }}
            >
              <X size={17} color="#8B8F9E" />
            </button>
          </div>
          <p
            className="font-inter"
            style={{
              marginTop: 12,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: '#5A6072',
            }}
          >
            <span style={{ color: '#1F2230', fontWeight: 600 }}>{name}</span>{' '}
            already exists in your database. Review the comparison and merge to keep the most complete record.
          </p>
        </header>

        {/* Body */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 24,
            gap: 22,
          }}
        >
          {/* Sticky column headers */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              position: 'sticky',
              top: -24,
              marginTop: -24,
              paddingTop: 24,
              paddingBottom: 4,
              background: '#fff',
              zIndex: 5,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                background: '#FBFAF7',
                border: '1px solid #EDECE6',
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <div
                className="font-poppins"
                style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
              >
                Existing candidate
              </div>
              <div
                className="font-inter"
                style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 2 }}
              >
                Already in your database
              </div>
            </div>
            <div
              className="flex items-center gap-2.5"
              style={{
                background: '#F5EFFF',
                border: '1px solid #DFCBFB',
                boxShadow: 'inset 0 0 0 1px #DFCBFB',
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  background: '#EDE4FF',
                  borderRadius: 7,
                }}
              >
                <GitMerge size={12} color="#6F3FF5" />
              </div>
              <div className="min-w-0">
                <div
                  className="font-poppins"
                  style={{ fontSize: 12.5, fontWeight: 600, color: '#5B21B6' }}
                >
                  After merge
                </div>
                <div
                  className="font-inter"
                  style={{ fontSize: 10.5, color: '#8567C7', marginTop: 2 }}
                >
                  {changedCount} {changedCount === 1 ? 'field' : 'fields'} updated
                </div>
              </div>
            </div>
          </div>

          <Section title="Contact information">
            <FieldRow icon={Mail} label="Email" existing={existingCandidate.email} merged={mergedCandidate.email} />
            <FieldRow icon={Phone} label="Phone" existing={existingCandidate.phone} merged={mergedCandidate.phone} />
          </Section>

          <Section title="Professional details">
            <FieldRow icon={MapPin} label="Location" existing={existingLocation} merged={mergedLocation} />
            <FieldRow icon={Briefcase} label="Current role" existing={existingCandidate.role_current} merged={mergedCandidate.role_current} />
            <FieldRow icon={DollarSign} label="Salary" existing={existingSalary} merged={mergedSalary} />
          </Section>

          <section style={{ flexShrink: 0 }}>
            <h3
              className="font-poppins"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#1F2230',
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '1px solid #F1F0EC',
              }}
            >
              Skills
            </h3>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Award size={13} color="#8B8F9E" />
              <span className="font-inter" style={{ fontSize: 11.5, fontWeight: 500, color: '#5A6072' }}>
                Skills
              </span>
              {skillsDiffer && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: '#6F3FF5',
                    display: 'inline-block',
                  }}
                />
              )}
            </div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Existing skills card */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #EDECE6',
                  borderRadius: 9,
                  padding: 12,
                }}
              >
                <div
                  className="font-inter"
                  style={{ fontSize: 10.5, fontWeight: 600, color: '#8B8F9E', marginBottom: 8 }}
                >
                  {existingSkills.length} skills
                </div>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {existingSkills.length === 0 ? (
                    <span className="font-inter italic" style={{ fontSize: 12, color: '#A8ACB8' }}>
                      Empty
                    </span>
                  ) : (
                    existingSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center font-inter"
                        style={{
                          height: 25,
                          borderRadius: 999,
                          padding: '0 10px',
                          background: '#F1F0EC',
                          color: '#4A4F60',
                          fontSize: 11.5,
                        }}
                      >
                        {s}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Merged skills card */}
              <div
                style={{
                  background: skillsDiffer ? '#F7F2FF' : '#fff',
                  border: `1px solid ${skillsDiffer ? '#DFCBFB' : '#EDECE6'}`,
                  boxShadow: skillsDiffer ? 'inset 0 0 0 1px #E7DFFB' : undefined,
                  borderRadius: 9,
                  padding: 12,
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span
                    className="font-inter"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: skillsDiffer ? '#6F3FF5' : '#8B8F9E',
                    }}
                  >
                    {mergedSkills.length} skills
                  </span>
                  {addedSkills.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{
                        background: '#EDE4FF',
                        color: '#6F3FF5',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: 9.5,
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <Plus size={10} />
                      {addedSkills.length} added
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {mergedSkills.length === 0 ? (
                    <span className="font-inter italic" style={{ fontSize: 12, color: '#A8ACB8' }}>
                      Empty
                    </span>
                  ) : (
                    mergedSkills.map((s) => {
                      const isNew = !existingSkills.includes(s)
                      return (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 font-inter"
                          style={{
                            height: 25,
                            borderRadius: 999,
                            padding: isNew ? '0 10px 0 8px' : '0 10px',
                            background: isNew ? '#EDE4FF' : '#F1F0EC',
                            color: isNew ? '#5B21B6' : '#4A4F60',
                            fontSize: 11.5,
                            fontWeight: isNew ? 500 : 400,
                          }}
                        >
                          {isNew && <Plus size={10} />}
                          {s}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer
          className="flex items-center gap-3"
          style={{
            padding: '13px 24px',
            borderTop: '1px solid #F1F0EC',
            background: '#FAFAF7',
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
            flexShrink: 0,
          }}
        >
          <div
            className="flex items-center gap-1.5 min-w-0"
            style={{ color: '#8B8F9E' }}
          >
            <GitMerge size={13} />
            <span
              className="font-inter truncate"
              style={{ fontSize: 11.5, color: '#8B8F9E' }}
            >
              Merging keeps the most complete info from both records
            </span>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center font-poppins hover:bg-[#F1F0EC] transition-colors"
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 8,
              background: 'transparent',
              color: '#1F2230',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.005em',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 font-poppins transition-opacity hover:opacity-90"
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 8,
              background: '#0d0d09',
              color: '#fffcf9',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.005em',
            }}
          >
            <GitMerge size={14} />
            Merge candidate
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
