import { Lock, Folder } from 'lucide-react'

export interface PreviewState {
  orgName?: string
  orgSlug?: string
  department?: string
  jobTitle?: string
  jobLocation?: string
  candidates?: Array<{
    name: string
    role: string
    company: string
    match: number
    initials: string
    color: string
  }>
  pipelineMode?: 'empty' | 'placeholder' | 'with-candidates'
  teamCount?: number
  showFinalStrip?: boolean
  searchingLabel?: string | null
  finalCaption?: boolean
}

const STAGES = [
  { label: 'Review', dot: '#ADB2BD' },
  { label: 'Screen', dot: '#C9B8FB' },
  { label: 'Interview', dot: '#A98BFA' },
  { label: 'Offer', dot: '#6F3FF5' },
]

const TEAM_AVATARS = [
  { letter: 'A', from: '#7C3AED', to: '#4F46E5' },
  { letter: 'M', from: '#0EA5E9', to: '#6366F1' },
  { letter: 'I', from: '#10B981', to: '#06B6D4' },
]

function CareersCard({
  orgName,
  orgSlug,
  department,
  jobTitle,
  jobLocation,
}: PreviewState) {
  const slug = orgSlug || 'workspace'
  const display = orgName || 'your workspace'
  return (
    <div
      className="ob-in"
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        boxShadow: '0 24px 48px -28px rgba(13,13,9,0.18)',
        overflow: 'hidden',
        border: '1px solid rgba(13,13,9,0.04)',
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          background: '#FAFAF7',
          borderBottom: '1px solid #F1F0EC',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: '#E0DDD3',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: '#F1F0EC',
            borderRadius: 6,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            color: '#8B8F9E',
          }}
        >
          <Lock size={9} strokeWidth={2} />
          <span>gogio.io/</span>
          <span style={{ color: '#0d0d09', fontWeight: 500 }}>{slug}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 22px 22px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: '#D7C5FB',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: '#8B8F9E',
            }}
          >
            CAREERS
          </span>
        </div>
        <h3
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: '#0d0d09',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          We're hiring at {display}
          <span style={{ color: '#D7C5FB' }}>.</span>
        </h3>

        {department && (
          <div
            className="ob-in"
            style={{
              marginTop: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#F6F5F1',
              borderRadius: 999,
              padding: '5px 10px',
              fontFamily: 'Inter, sans-serif',
              fontSize: 11.5,
              color: '#5A6072',
            }}
          >
            <Folder size={11} strokeWidth={2} />
            <span>
              {department} · {jobTitle ? '1 job' : '0 jobs'}
            </span>
          </div>
        )}

        {jobTitle && (
          <div
            className="ob-in"
            style={{
              marginTop: 14,
              border: '1px solid #F1F0EC',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              animationDelay: '0.1s',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0d0d09',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {jobTitle}
              </div>
              {jobLocation && (
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11,
                    color: '#8B8F9E',
                    marginTop: 2,
                  }}
                >
                  {jobLocation}
                </div>
              )}
            </div>
            <span
              style={{
                background: '#DCFCE7',
                color: '#15803D',
                fontFamily: 'Inter, sans-serif',
                fontSize: 10.5,
                fontWeight: 600,
                padding: '4px 9px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: '#22C55E',
                  display: 'inline-block',
                }}
              />
              Open
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function PipelineCard({
  candidates,
  teamCount,
  mode = 'placeholder',
}: {
  candidates?: PreviewState['candidates']
  teamCount?: number
  mode?: 'empty' | 'placeholder' | 'with-candidates'
}) {
  const showCandidateChips = mode === 'with-candidates' && candidates && candidates.length > 0
  return (
    <div
      className="ob-in"
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        boxShadow: '0 24px 48px -28px rgba(13,13,9,0.18)',
        padding: '16px 18px 18px',
        border: '1px solid rgba(13,13,9,0.04)',
        animationDelay: '0.15s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#0d0d09',
            }}
          >
            Pipeline
          </span>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 10.5,
              color: '#8B8F9E',
            }}
          >
            set up by Gio
          </span>
        </div>
        {teamCount && teamCount > 0 ? (
          <div className="ob-in" style={{ display: 'flex' }}>
            {TEAM_AVATARS.slice(0, teamCount).map((a, i) => (
              <span
                key={i}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
                  color: '#FFFFFF',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: i === 0 ? 0 : -7,
                  border: '2px solid #FFFFFF',
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                {a.letter}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {STAGES.map((s, idx) => {
          const isReview = idx === 0
          return (
            <div key={s.label}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: s.dot,
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10.5,
                    fontWeight: 500,
                    color: '#5A6072',
                  }}
                >
                  {s.label}
                </span>
                {isReview && showCandidateChips ? (
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 10,
                      color: '#8B8F9E',
                      marginLeft: 'auto',
                    }}
                  >
                    {candidates!.length}
                  </span>
                ) : null}
              </div>
              {isReview && showCandidateChips ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {candidates!.map((c, i) => (
                    <div
                      key={i}
                      className="ob-in"
                      style={{
                        background: '#FAFAF7',
                        border: '1px solid #F1F0EC',
                        borderRadius: 6,
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        animationDelay: `${0.3 + i * 0.12}s`,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          background: c.color,
                          color: '#FFFFFF',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 8,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {c.initials}
                      </span>
                      <span
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: 10.5,
                          color: '#0d0d09',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: '#FAFAF7',
                    border: '1px dashed #E7E8EE',
                    borderRadius: 6,
                    minHeight: 34,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SearchingCard({ label }: { label: string }) {
  return (
    <div
      className="ob-in"
      style={{
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1px solid #F1F0EC',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 0.18, 0.36].map((d, i) => (
          <span
            key={i}
            className="ob-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: '#D7C5FB',
              display: 'inline-block',
              animationDelay: `${d}s`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          color: '#5A6072',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function CandidateCards({ candidates }: { candidates: PreviewState['candidates'] }) {
  if (!candidates || candidates.length === 0) return null
  return (
    <>
      {candidates.map((c, i) => (
        <div
          key={i}
          className="ob-in"
          style={{
            background: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #F1F0EC',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animationDelay: `${0.2 + i * 0.12}s`,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: c.color,
              color: '#FFFFFF',
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {c.initials}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12.5,
                fontWeight: 600,
                color: '#0d0d09',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {c.name}
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 10.5,
                color: '#8B8F9E',
                marginTop: 1,
              }}
            >
              {c.role} · {c.company}
            </div>
          </div>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: '#6F3FF5',
            }}
          >
            {c.match}%
          </span>
          <span
            style={{
              background: '#EDE4FF',
              color: '#5B21B6',
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
            }}
          >
            Shortlist
          </span>
        </div>
      ))}
    </>
  )
}

function FinalStrip() {
  return (
    <div
      className="ob-in"
      style={{
        background: '#0d0d09',
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        animationDelay: '0.25s',
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="9" rx="1.5" fill="#fffcf9" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#fffcf9" opacity="0.7" />
        <rect x="12" y="3" width="9" height="7" rx="1.5" fill="#fffcf9" opacity="0.7" />
        <rect x="12" y="12" width="9" height="9" rx="1.5" fill="#fffcf9" />
        <circle cx="20" cy="5" r="2" fill="#D7C5FB" />
      </svg>
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11.5,
          fontWeight: 500,
          color: '#fffcf9',
        }}
      >
        Your queue is ready — 3 candidates to review.
      </span>
    </div>
  )
}

export function WorkspacePreview(props: PreviewState) {
  const {
    searchingLabel,
    candidates,
    pipelineMode,
    teamCount,
    showFinalStrip,
    jobTitle,
    finalCaption,
  } = props

  // Show pipeline once a job exists
  const showPipeline = !!jobTitle

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        margin: 20,
        marginLeft: 0,
        borderRadius: 20,
        background: '#F6F5F1',
        border: '1px solid #ECEAE2',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      {/* Lilac radial glow top-right */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 280,
          height: 280,
          background:
            'radial-gradient(circle, rgba(215,197,251,0.35), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
        }}
      >
        <CareersCard {...props} />
        {showPipeline && (
          <PipelineCard
            candidates={candidates}
            teamCount={teamCount}
            mode={pipelineMode || 'placeholder'}
          />
        )}
        {searchingLabel && <SearchingCard label={searchingLabel} />}
        {pipelineMode === 'with-candidates' && (
          <CandidateCards candidates={candidates} />
        )}
        {showFinalStrip && <FinalStrip />}
      </div>

      {/* Caption */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          color: '#B5B9C4',
          letterSpacing: '0.04em',
        }}
      >
        {finalCaption ? 'your workspace' : 'your workspace, assembling'}
      </div>
    </div>
  )
}
