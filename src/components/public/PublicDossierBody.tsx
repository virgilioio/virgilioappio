/**
 * The dossier as rendered for a client on the public page.
 *
 * Everything internal is already gone by the time this component sees the data —
 * it renders what it is given and offers the three hero actions. Layout mirrors
 * the in-app dossier: one sheet at 1080 with a 360 rail.
 */
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, GraduationCap, MapPin } from 'lucide-react'

import type { PublicDossierPayload } from '@/pages/PublicDossier'
import {
  buildSkillGroups,
  computeExperienceStats,
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
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

export function PublicDossierBody({
  payload,
  decision,
  isSending,
  error,
  onDownload,
  onDecision,
  icons,
}: PublicDossierBodyProps) {
  const { analysis, candidate, score } = payload
  const summary = splitExecutiveSummary(analysis.executive_summary ?? '')
  const stats = computeExperienceStats(payload.work_experience)
  const skillGroups = buildSkillGroups(
    payload.required_skills,
    candidate.skills,
    readSkillEvidence(analysis),
  )
  const profileSummary = analysis.profile_summary || candidate.profile_summary || ''
  // Only the positive half of the executive summary belongs in a client view.
  const strongestSignal = summary?.strongest ?? ''
  const skillSections = [
    { title: 'Evidenced', items: skillGroups.evidenced },
    { title: 'Partly evidenced', items: skillGroups.partly },
    { title: 'Not evidenced', items: skillGroups.notEvidenced },
  ].filter((section) => section.items.length > 0)

  return (
    <div>
      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ ...HEADING, color: '#6F3FF5' }}>Candidate dossier · {payload.job_title}</p>
          <h1
            className="font-poppins"
            style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1, margin: '6px 0 0', color: '#1F2230' }}
          >
            {candidate.name}
            <span style={{ color: '#C4B5FD' }}>.</span>
          </h1>
          {candidate.role_line && (
            <p className="font-inter" style={{ fontSize: 13.5, fontWeight: 500, color: '#1F2230', margin: '6px 0 0' }}>
              {candidate.role_line}
            </p>
          )}
          {candidate.location && (
            <p className="font-inter" style={{ fontSize: 12, color: '#5A6072', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={12} color="#8B8F9E" />{candidate.location}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={HEADING}>Gio fit</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
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

      {/* Hero actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid #F1F0EC' }}>
        {onDownload && (
          <HeroButton icon={icons.download} tone="secondary" onClick={onDownload}>Download PDF</HeroButton>
        )}
        {decision
          ? (
            <p className="font-inter" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#1F7A45', margin: 0 }}>
              <CheckCircle2 size={14} />
              {decision === 'interview_requested'
                ? 'Interview requested — the recruiter has been notified.'
                : 'Recorded as not a fit — the recruiter has been notified.'}
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
          gap: 26,
          marginTop: 24,
          alignItems: 'start',
        }}
        className="public-dossier-grid"
      >
        <div>
          {(profileSummary || strongestSignal) && (
            <section>
              <p style={HEADING}>Summary</p>
              {profileSummary && (
                <p className="font-inter" style={{ fontSize: 13, lineHeight: 1.6, color: '#1F2230', margin: '8px 0 0' }}>{stripHtml(profileSummary)}</p>
              )}
              {summary.headline && (
                <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.6, color: '#5A6072', margin: '10px 0 0' }}>{summary.headline}</p>
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

          {skillGroups.length > 0 && (
            <section style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #F1F0EC' }}>
              <p style={HEADING}>Identified skills</p>
              {skillGroups.map((group) => (
                <div key={group.title} style={{ marginTop: 12 }}>
                  <p className="font-inter" style={{ fontSize: 11.5, fontWeight: 600, color: '#5A6072', margin: 0 }}>{group.title}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                    {group.items.map((item) => (
                      <span
                        key={item.label}
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
                        {item.label}
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
        </div>

        {/* Rail */}
        <div>
          <section style={{ border: '1px solid #EDEBE3', borderRadius: 14, padding: 16 }}>
            <p style={HEADING}>Assessment</p>
            <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', margin: '7px 0 0', lineHeight: 1.5 }}>
              Open evidence sits beneath each line.
            </p>
            {analysis.dimensions.map((dimension) => (
              <div key={dimension.name} style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span className="font-inter" style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>{dimension.name}</span>
                  <span className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#6F3FF5', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(Number(dimension.score ?? 0))}
                  </span>
                </div>
                <div style={{ marginTop: 6 }}><Bar value={Number(dimension.score ?? 0)} /></div>
                {dimension.insight && (
                  <p className="font-inter" style={{ fontSize: 11.5, lineHeight: 1.5, color: '#5A6072', margin: '7px 0 0' }}>{dimension.insight}</p>
                )}
                {(dimension.matches ?? []).length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                    {dimension.matches!.map((match) => (
                      <li key={match} className="font-inter" style={{ fontSize: 11.5, lineHeight: 1.5, color: '#1F7A45' }}>{match}</li>
                    ))}
                  </ul>
                )}
                {(dimension.gaps ?? []).length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {dimension.gaps!.map((gap) => (
                      <li key={gap} className="font-inter" style={{ fontSize: 11.5, lineHeight: 1.5, color: '#8B8F9E' }}>{gap}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          {analysis.validation_points.length > 0 && (
            <section style={{ border: '1px solid #EDEBE3', borderRadius: 14, padding: 16, marginTop: 14 }}>
              <p style={HEADING}>Still to verify</p>
              <p className="font-inter" style={{ fontSize: 11.5, color: '#5A6072', margin: '7px 0 0', lineHeight: 1.5 }}>
                Questions to settle together during the next conversation.
              </p>
              {analysis.validation_points.map((point) => (
                <div key={point.question} style={{ marginTop: 12 }}>
                  <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.5, color: '#1F2230', margin: 0 }}>{point.question}</p>
                  {point.reason && (
                    <p className="font-inter" style={{ fontSize: 11.5, lineHeight: 1.45, color: '#8B8F9E', margin: '4px 0 0' }}>{point.reason}</p>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {/* Provenance */}
      <p
        className="font-inter"
        style={{ fontSize: 11, color: '#8B8F9E', margin: '24px 0 0', paddingTop: 14, borderTop: '1px solid #F1F0EC' }}
      >
        Prepared by {payload.prepared_by || payload.workspace_name} ·{' '}
        {new Date(payload.prepared_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <style>{`
        @media (max-width: 1000px) {
          .public-dossier-grid { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
