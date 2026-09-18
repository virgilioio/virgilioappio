/**
 * The dossier as rendered for a client on the public page.
 *
 * Everything internal is already gone by the time this component sees the data —
 * there is no view mode here to flip, and no field to hide. Layout mirrors the
 * in-app dossier: one sheet at 1080 with a 360 rail that stacks below 900px.
 */
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, ChevronDown, GraduationCap, Languages, MapPin } from 'lucide-react'

import type { PublicDossierPayload } from '@/pages/PublicDossier'
import { getGioFitLanguage } from '@/lib/gioFitLanguages'
import {
  buildSkillGroups,
  computeExperienceStats,
  dropScoreClause,
  educationYear,
  formatDate,
  formatDuration,
  getScoreBand,
  readSkillEvidence,
  splitExecutiveSummary,
  stripHtml,
} from '@/components/candidates/insights/dossier/dossierData'

interface PublicDossierBodyProps {
  payload: PublicDossierPayload
  decision: string | null
  decisionOn: string | null
  isSending: boolean
  error: string | null
  onDownload?: () => void
  onDecision: (decision: 'interview_requested' | 'not_a_fit') => void
  icons: { download: LucideIcon; notAFit: LucideIcon; requested: LucideIcon }
}

const HEADING: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#8B8F9E',
  margin: 0,
}

function HeroButton({
  children,
  icon: Icon,
  tone,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  icon: LucideIcon
  tone: 'primary' | 'secondary'
  disabled?: boolean
  onClick?: () => void
}) {
  const skin = tone === 'primary'
    ? { background: '#6F3FF5', color: '#fff', border: '1px solid #6F3FF5' }
    : { background: '#fff', color: '#1F2230', border: '1px solid #E0DDD3' }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="public-dossier-action"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        height: 34,
        padding: '0 13px',
        borderRadius: 8,
        fontFamily: 'Poppins, sans-serif',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...skin,
      }}
    >
      <Icon size={14} />
      {children}
    </button>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <span style={{ display: 'block', height: 4, borderRadius: 999, background: '#F1F0EC', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: '#6F3FF5' }} />
    </span>
  )
}

const longDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export function PublicDossierBody({
  payload,
  decision,
  decisionOn,
  isSending,
  error,
  onDownload,
  onDecision,
  icons,
}: PublicDossierBodyProps) {
  const { analysis, candidate, score } = payload
  // One dimension open at a time — the rail is a reading order, not a dashboard.
  const [openDimension, setOpenDimension] = useState<string | null>(null)

  const summary = splitExecutiveSummary(analysis.executive_summary ?? '')
  const stats = computeExperienceStats(payload.work_experience)
  const skillGroups = buildSkillGroups(
    payload.required_skills,
    candidate.skills,
    readSkillEvidence(analysis),
  )
  const profileSummary = analysis.profile_summary || candidate.profile_summary || ''
  const strongestSignal = summary?.strongest ?? ''
  // The client has no model of how the score is held, so the mechanics clause goes.
  const biggestRisk = summary?.risk ? dropScoreClause(summary.risk) : ''
  const skillSections = [
    { title: 'Evidenced', items: skillGroups.evidenced },
    { title: 'Partly evidenced', items: skillGroups.partly },
    { title: 'Required, not evidenced', items: skillGroups.notEvidenced },
  ].filter((section) => section.items.length > 0)

  const outputLanguageCode = payload.output_language || 'en'
  const outputLanguageName = getGioFitLanguage(outputLanguageCode).name
  const sourceLanguages = [...new Set(
    (analysis.detected_languages?.sources ?? [])
      .filter((source) => source.code !== outputLanguageCode)
      .map((source) => source.name),
  )]

  const confirmation = decision === 'interview_requested'
    ? `Interview requested on ${longDate(decisionOn ?? new Date().toISOString())}. ${payload.prepared_by || payload.workspace_name} has been notified and will be in touch.`
    : decision
      ? `Marked as not a fit on ${longDate(decisionOn ?? new Date().toISOString())}. ${payload.prepared_by || payload.workspace_name} has been notified.`
      : null

  return (
    <div>
      {/* Masthead */}
      <div className="public-dossier-hero" style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ ...HEADING, color: '#6F3FF5' }}>Candidate dossier · {payload.job_title}</p>
          <h1
            className="font-poppins"
            style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1, margin: '6px 0 0', color: '#1F2230' }}
          >
            {candidate.name}
            <span style={{ color: '#D7C5FB' }}>.</span>
          </h1>
          {candidate.role_line && (
            <p className="font-inter" style={{ fontSize: 13.5, fontWeight: 500, color: '#1F2230', margin: '6px 0 0' }}>
              {candidate.role_line}
            </p>
          )}
          {candidate.location && (
            <p className="font-inter" style={{ fontSize: 12, color: '#5A6072', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={12} color="#B9B7AC" />{candidate.location}
            </p>
          )}
        </div>
        {/* Score seal — no rank, no median: that is our pipeline, not their decision. */}
        <div className="public-dossier-seal" style={{ textAlign: 'right' }}>
          <p style={HEADING}>Gio fit</p>
          <div className="public-dossier-seal-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
            <p className="font-poppins" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: '#6F3FF5', margin: 0 }}>
              {Math.round(score)}
            </p>
            <div style={{ textAlign: 'left', paddingBottom: 3 }}>
              <p className="font-poppins" style={{ fontSize: 13, fontWeight: 600, color: '#1F2230', margin: 0 }}>{getScoreBand(score)} fit</p>
              <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', margin: '2px 0 0', textTransform: 'capitalize' }}>
                {analysis.confidence} confidence
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action row — provenance on the left, the client's two answers on the right */}
      <div
        className="public-dossier-actions"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid #F1F0EC' }}
      >
        <p
          className="font-inter"
          style={{ flex: 1, minWidth: 220, fontSize: 11.5, lineHeight: 1.5, color: '#8B8F9E', margin: 0 }}
        >
          Prepared by {payload.prepared_by || payload.workspace_name} at {payload.workspace_name} ·{' '}
          {longDate(payload.prepared_on)} · Assessed against your brief for {payload.job_title}
        </p>
        {onDownload && (
          <HeroButton icon={icons.download} tone="secondary" onClick={onDownload}>Download PDF</HeroButton>
        )}
        {confirmation
          ? (
            <p
              className="font-inter"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: decision === 'interview_requested' ? '#1F7A45' : '#5A6072',
                margin: 0,
              }}
            >
              {decision === 'interview_requested' && <CheckCircle2 size={14} style={{ flexShrink: 0 }} />}
              {confirmation}
            </p>
          )
          : (
            <>
              <HeroButton icon={icons.notAFit} tone="secondary" disabled={isSending} onClick={() => onDecision('not_a_fit')}>
                Not a fit
              </HeroButton>
              <HeroButton icon={icons.requested} tone="primary" disabled={isSending} onClick={() => onDecision('interview_requested')}>
                Request interview
              </HeroButton>
            </>
          )}
        {error && (
          <p role="alert" className="font-inter" style={{ fontSize: 12, color: '#B42318', margin: 0 }}>{error}</p>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 360px',
          gap: 14,
          marginTop: 24,
          alignItems: 'start',
        }}
        className="public-dossier-grid"
      >
        <div>
          {(profileSummary || strongestSignal || biggestRisk) && (
            <section>
              <p style={HEADING}>Summary</p>
              {profileSummary && (
                <p className="font-inter" style={{ fontSize: 13, lineHeight: 1.6, color: '#1F2230', margin: '8px 0 0' }}>{stripHtml(profileSummary)}</p>
              )}
              {strongestSignal && (
                <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.6, color: '#5A6072', margin: '10px 0 0' }}>{strongestSignal}</p>
              )}
              {biggestRisk && (
                <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.6, color: '#5A6072', margin: '6px 0 0' }}>{biggestRisk}</p>
              )}
              {stats.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 14 }}>
                  {stats.map((stat) => (
                    <span key={stat.label}>
                      <span className="font-poppins" style={{ display: 'block', fontSize: 17, fontWeight: 600, color: '#1F2230', letterSpacing: '-0.03em' }}>{stat.value}</span>
                      <span className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>{stat.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {skillSections.length > 0 && (
            <section style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F1F0EC' }}>
              <p style={HEADING}>Identified skills</p>
              {skillSections.map((group) => (
                <div key={group.title} style={{ marginTop: 12 }}>
                  <p className="font-inter" style={{ fontSize: 11.5, fontWeight: 600, color: '#5A6072', margin: 0 }}>{group.title}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                    {group.items.map((item) => (
                      <span
                        key={item.skill}
                        title={item.evidence ?? undefined}
                        className="font-inter"
                        style={{
                          fontSize: 11.5,
                          padding: '4px 9px',
                          borderRadius: 999,
                          background: '#F6F5F1',
                          border: '1px solid #EDEBE3',
                          color: '#1F2230',
                        }}
                      >
                        {item.skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {payload.work_experience.length > 0 && (
            <section style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F1F0EC' }}>
              <p style={HEADING}>Experience</p>
              {payload.work_experience.map((role) => (
                <div key={role.id ?? `${role.company_name}-${role.start_date}`} style={{ marginTop: 14 }}>
                  <p className="font-poppins" style={{ fontSize: 13.5, fontWeight: 600, color: '#1F2230', margin: 0 }}>{role.job_title}</p>
                  <p className="font-inter" style={{ fontSize: 12, color: '#5A6072', margin: '3px 0 0' }}>
                    {[role.company_name, role.location].filter(Boolean).join(' · ')}
                  </p>
                  <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', margin: '3px 0 0' }}>
                    {formatDate(role.start_date)} — {role.is_current ? 'Present' : formatDate(role.end_date)}
                    {` · ${formatDuration(role.start_date, role.is_current ? null : role.end_date)}`}
                  </p>
                  {role.description && (
                    <p className="font-inter" style={{ fontSize: 12, lineHeight: 1.6, color: '#1F2230', margin: '7px 0 0' }}>{stripHtml(role.description)}</p>
                  )}
                </div>
              ))}
            </section>
          )}

          {payload.education.length > 0 && (
            <section style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F1F0EC' }}>
              <p style={HEADING}>Education</p>
              {payload.education.map((entry) => (
                <div key={entry.id ?? entry.institution_name} style={{ display: 'flex', gap: 9, marginTop: 12 }}>
                  <GraduationCap size={14} color="#8B8F9E" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    <span className="font-inter" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}>
                      {[entry.degree_type, entry.field_of_study].filter(Boolean).join(', ')}
                    </span>
                    <span className="font-inter" style={{ display: 'block', fontSize: 11.5, color: '#5A6072' }}>
                      {entry.institution_name}
                      {educationYear(entry) ? ` · ${educationYear(entry)}` : ''}
                    </span>
                  </span>
                </div>
              ))}
            </section>
          )}

          {sourceLanguages.length > 0 && (
            <section style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F1F0EC' }}>
              <p style={HEADING}>Languages of the source material</p>
              <p
                className="font-inter"
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#5A6072', margin: '8px 0 0', lineHeight: 1.5 }}
              >
                <Languages size={13} color="#6F3FF5" style={{ flexShrink: 0 }} />
                Written in {outputLanguageName} from {sourceLanguages.join(' and ')} source material.
              </p>
            </section>
          )}
        </div>

        {/* Rail */}
        <div className="public-dossier-rail">
          <section style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 14, padding: 16 }}>
            <p style={HEADING}>Dimension breakdown</p>
            <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', margin: '7px 0 0', lineHeight: 1.5 }}>
              How this candidate reads against each part of the brief. Open a row for the evidence behind it.
            </p>
            {analysis.dimensions.map((dimension) => {
              const isOpen = openDimension === dimension.name
              const matches = dimension.matches ?? []
              const gaps = dimension.gaps ?? []
              return (
                <div key={dimension.name} style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setOpenDimension(isOpen ? null : dimension.name)}
                    aria-expanded={isOpen}
                    style={{
                      display: 'block',
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span className="font-inter" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>
                        <ChevronDown
                          size={12}
                          color="#8B8F9E"
                          style={{ transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 140ms ease' }}
                        />
                        {dimension.name}
                      </span>
                      <span className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#6F3FF5', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(Number(dimension.score ?? 0))}
                      </span>
                    </span>
                    <span style={{ display: 'block', marginTop: 6 }}><Bar value={Number(dimension.score ?? 0)} /></span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 8 }}>
                      <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', margin: 0 }}>
                        {matches.length} {matches.length === 1 ? 'match' : 'matches'} · {gaps.length} {gaps.length === 1 ? 'gap' : 'gaps'}
                      </p>
                      {dimension.insight && (
                        <p className="font-inter" style={{ fontSize: 11.5, lineHeight: 1.5, color: '#5A6072', margin: '7px 0 0' }}>{dimension.insight}</p>
                      )}
                      {matches.map((match) => (
                        <p
                          key={match}
                          className="font-inter"
                          style={{ fontSize: 11.5, lineHeight: 1.5, color: '#1F2230', margin: '7px 0 0', paddingLeft: 9, borderLeft: '2px solid #1F7A45' }}
                        >
                          {match}
                        </p>
                      ))}
                      {/* The gaps stay — the red items are why the client believes the green ones. */}
                      {gaps.map((gap) => (
                        <p
                          key={gap}
                          className="font-inter"
                          style={{ fontSize: 11.5, lineHeight: 1.5, color: '#5A6072', margin: '7px 0 0', paddingLeft: 9, borderLeft: '2px solid #D9534F' }}
                        >
                          {gap}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          {analysis.validation_points.length > 0 && (
            <section style={{ background: '#fff', border: '1px solid #E7E8EE', borderRadius: 14, padding: 16, marginTop: 14 }}>
              <p style={HEADING}>Still to verify</p>
              <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', margin: '7px 0 0', lineHeight: 1.5 }}>
                What this dossier could not settle from the written record. We are covering these in the remaining
                interviews.
              </p>
              {analysis.validation_points.map((point) => (
                <div key={point.question} style={{ marginTop: 12 }}>
                  <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.5, color: '#1F2230', margin: 0 }}>{point.question}</p>
                  {point.reason && (
                    <p className="font-inter" style={{ fontSize: 11.5, lineHeight: 1.45, color: '#8B8F9E', margin: '4px 0 0' }}>{point.reason}</p>
                  )}
                  {point.suggested_stage && (
                    <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', margin: '3px 0 0' }}>{point.suggested_stage}</p>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .public-dossier-grid { grid-template-columns: minmax(0,1fr) !important; }
          .public-dossier-hero { flex-direction: column; }
          .public-dossier-seal { text-align: left !important; width: 100%; }
          .public-dossier-seal-row { justify-content: flex-start !important; }
          .public-dossier-actions .public-dossier-action { width: 100%; }
        }
        @media print {
          .public-dossier-actions { display: none !important; }
          .public-dossier-grid { display: block !important; }
          .public-dossier-rail { margin-top: 18px; }
        }
      `}</style>
    </div>
  )
}
