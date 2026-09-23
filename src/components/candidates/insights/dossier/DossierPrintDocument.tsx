import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FitAnalysis, FitDimension, ValidationPoint } from '@/hooks/useCandidateFitInsights'
import { GioAtsLogo } from '@/components/brand/GioAtsLogo'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
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
} from './dossierData'
import type { DossierScorecard } from './dossierScorecards'
import { shortDossierDate } from './dossierScorecards'
import { ratingLabel } from '@/lib/scorecardRatings'
import { SafeHtml } from '@/components/ui/safe-html'
import { DossierExperienceGroups } from '@/components/candidates/experience/DossierExperienceGroups'
import { groupExperience } from '@/lib/experience/groupExperience'

export interface DossierPrintProps {
  analysis: FitAnalysis
  score: number
  candidateName: string
  roleLine: string | null
  jobTitle: string | null
  location: string | null
  contactItems: string[]
  requiredSkills: string[]
  candidateSkills: string[]
  workExperience: CandidateWorkExperience[]
  education: CandidateEducation[]
  salaryExpectation?: string | null
  scorecards: DossierScorecard[]
  outputLanguageName: string | null
  clientReady: boolean
  includeContact: boolean
  includeEvidence: boolean
  includeValidation: boolean
  pageSize: DossierPageSize
  preparedBy: string | null
  preparedOn: string
}

export type DossierPageSize = 'letter' | 'a4'

/** One geometry source for the document and for the dialog's preview. */
export const DOSSIER_PAGE_GEOMETRY: Record<DossierPageSize, { width: number; height: number }> = {
  letter: { width: 816, height: 1056 },
  a4: { width: 794, height: 1123 },
}

const PAGE_MARGIN = 56
const FOOTER_BAND = 30

interface Block {
  key: string
  node: ReactNode
  keepWithNext?: boolean
  breakBefore?: boolean
}

const RUNNING_HEAD_HEIGHT = 42

function Heading({ children, spaced }: { children: string; spaced?: boolean }) {
  return <p className={spaced ? 'gio-heading gio-section-gap' : 'gio-heading'}>{children}</p>
}

/**
 * Flows the measured blocks onto pages. This is the single pagination routine —
 * the dialog's page count and the footers' "of n" both come out of here.
 */
export function paginateBlocks(blocks: Block[], heights: number[], pageSize: DossierPageSize): Block[][] {
  const contentHeight = DOSSIER_PAGE_GEOMETRY[pageSize].height - PAGE_MARGIN * 2 - FOOTER_BAND
  const result: Block[][] = []
  let current: Block[] = []
  let used = 0
  let index = 0

  while (index < blocks.length) {
    if (blocks[index]?.breakBefore && current.length > 0) {
      result.push(current)
      current = []
      used = 0
    }
    // A group is a block plus every block it must stay with (headings + first row).
    let end = index
    while (blocks[end]?.keepWithNext && end + 1 < blocks.length) end += 1
    const groupHeight = heights.slice(index, end + 1).reduce((sum, value) => sum + value, 0)
    const limit = contentHeight - (result.length > 0 ? RUNNING_HEAD_HEIGHT : 0)

    if (current.length > 0 && used + groupHeight > limit) {
      result.push(current)
      current = []
      used = 0
    }
    for (let i = index; i <= end; i += 1) current.push(blocks[i])
    used += groupHeight
    index = end + 1
  }
  if (current.length > 0) result.push(current)
  return result.length > 0 ? result : [[]]
}

function useBlockPages(blocks: Block[], pageSize: DossierPageSize) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<Block[][] | null>(null)

  useLayoutEffect(() => {
    setPages(null)
  }, [blocks, pageSize])

  useLayoutEffect(() => {
    if (pages || !measureRef.current) return
    const nodes = Array.from(measureRef.current.children) as HTMLElement[]
    const heights = nodes.map((node) => node.getBoundingClientRect().height)
    setPages(paginateBlocks(blocks, heights, pageSize))
  }, [blocks, pages, pageSize])

  return { measureRef, pages }
}

export function DossierPrintDocument({
  data,
  onReady,
  onPageCount,
}: {
  data: DossierPrintProps
  onReady?: () => void
  onPageCount?: (count: number) => void
}) {
  const blocks = useMemo(() => buildBlocks(data), [data])
  const { measureRef, pages } = useBlockPages(blocks, data.pageSize)

  useEffect(() => {
    if (!pages || !onReady) return
    const frame = requestAnimationFrame(() => onReady())
    return () => cancelAnimationFrame(frame)
  }, [pages, onReady])

  useEffect(() => {
    if (pages && onPageCount) onPageCount(pages.length)
  }, [pages, onPageCount])

  const total = pages?.length ?? 1
  const geometry = DOSSIER_PAGE_GEOMETRY[data.pageSize]
  const contentWidth = geometry.width - PAGE_MARGIN * 2
  const footer = `Confidential${data.preparedBy ? ` — prepared by ${data.preparedBy}` : ''}, ${data.preparedOn}`

  return (
    <div className="gio-print-root">
      {!pages && (
        <div className="gio-measure" ref={measureRef} style={{ width: contentWidth }}>
          {blocks.map((block) => (
            <div key={block.key}>{block.node}</div>
          ))}
        </div>
      )}
      {pages?.map((pageBlocks, pageIndex) => (
        <div className={data.pageSize === 'a4' ? 'gio-page gio-page--a4' : 'gio-page'} key={`page-${pageIndex}`}>
          {!data.clientReady && <div className="gio-watermark">Internal</div>}
          {pageIndex > 0 && (
            <div className="gio-runhead">
              <span className="gio-runhead-name">{data.candidateName}</span>
              <span className="gio-runhead-meta">
                Gio dossier{data.jobTitle ? ` · ${data.jobTitle}` : ''}
              </span>
              <span className="gio-runhead-score">
                Gio fit <b>{Math.round(data.score)}</b>
              </span>
            </div>
          )}
          {pageBlocks.map((block) => (
            <Fragment key={block.key}>{block.node}</Fragment>
          ))}
          <div className="gio-foot">
            <span>{footer}</span>
            <span className="gio-foot-brand">Generated by Gio · Virgilio Technologies LLC — All rights reserved</span>
            <span className="gio-foot-pages">
              Page {pageIndex + 1} of {total}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function buildBlocks(data: DossierPrintProps): Block[] {
  const {
    analysis,
    score,
    candidateName,
    roleLine,
    jobTitle,
    location,
    contactItems,
    requiredSkills,
    candidateSkills,
    workExperience,
    education,
    salaryExpectation,
    scorecards,
    outputLanguageName,
    clientReady,
    includeContact,
    includeEvidence,
    includeValidation,
  } = data

  const blocks: Block[] = []
  const executiveSplit = splitExecutiveSummary(analysis.executive_summary)
  const stats = computeExperienceStats(workExperience, salaryExpectation)
  const skills = buildSkillGroups(requiredSkills, candidateSkills, readSkillEvidence(analysis))
  const dimensions = analysis.dimensions || []
  const visibleDimensions = clientReady ? dimensions.filter((dimension) => !/salary|compensation/i.test(dimension.name)) : dimensions
  const scored = dimensions.filter((dimension) => dimension.score !== null)
  const scoredWeight = scored.reduce((sum, dimension) => sum + (Number(dimension.weight) || 0), 0)
  const contributionTotal = scored.reduce((sum, dimension) => sum + Number(dimension.score) * (Number(dimension.weight) || 0) / 100, 0)
  const nullDimensions = dimensions.filter((dimension) => dimension.score === null)
  const validationPoints = (clientReady
    ? (analysis.validation_points || []).filter((point) => !/salary|compensation|pay|remuneration/i.test(`${point.question} ${point.reason}`))
    : analysis.validation_points || []) as ValidationPoint[]

  const metaItems = [location, ...(includeContact && !clientReady ? contactItems : [])].filter(Boolean) as string[]

  blocks.push({
    key: 'masthead',
    node: (
      <div className="gio-block gio-masthead">
        <div style={{ minWidth: 0 }}>
          <GioAtsLogo height={22} className="gio-logo" />
          <p className="gio-eyebrow">Gio dossier{jobTitle ? ` · prepared for ${jobTitle}` : ''}</p>
          <h1 className="gio-name">
            {candidateName}
            <span>.</span>
          </h1>
          {roleLine && <p className="gio-role">{roleLine}</p>}
          {metaItems.length > 0 && <p className="gio-meta">{metaItems.join(' · ')}</p>}
        </div>
        <div className="gio-seal">
          <p className="gio-seal-label">Gio fit</p>
          <div className="gio-seal-row">
            <span className="gio-seal-score">{Math.round(score)}</span>
            <span className="gio-seal-band">
              <b>{getScoreBand(score)} fit</b>
              <i>{analysis.confidence} confidence</i>
            </span>
          </div>
        </div>
      </div>
    ),
  })

  const summaryProse = typeof analysis.profile_summary === 'string' ? analysis.profile_summary.trim() : ''
  if (summaryProse || executiveSplit || stats.length > 0) {
    blocks.push({ key: 'summary-heading', node: <Heading spaced>Summary</Heading>, keepWithNext: true })
    blocks.push({
      key: 'summary',
      node: (
        <div className="gio-block gio-summary">
          <div className="gio-summary-main">
            {summaryProse && <p className="gio-prose">{summaryProse}</p>}
            {executiveSplit ? (
              <div className="gio-callouts">
                <div className="gio-callout signal">
                  <p className="gio-callout-title">Strongest signal</p>
                  <p>{executiveSplit.strongest}</p>
                </div>
                <div className="gio-callout risk">
                  <p className="gio-callout-title">Biggest risk</p>
                  <p>{clientReady ? dropScoreClause(executiveSplit.risk) : executiveSplit.risk}</p>
                </div>
              </div>
            ) : (
              analysis.executive_summary && <p className="gio-prose" style={{ marginTop: summaryProse ? 10 : 0 }}>{analysis.executive_summary}</p>
            )}
          </div>
          {stats.length > 0 && (
            <div className="gio-stats">
              {stats.map((stat) => (
                <div className="gio-stat" key={stat.label}>
                  <span className="gio-stat-value">{stat.value}</span>
                  <span className="gio-stat-label">
                    {stat.label}
                    {stat.footnote && <i>{stat.footnote}</i>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    })
  }

  const skillRows = [
    { label: 'Required and evidenced', items: skills.evidenced, chip: 'evidenced' },
    { label: 'Required, partly evidenced', items: skills.partly, chip: 'partial' },
    { label: 'Required, not evidenced', items: skills.notEvidenced, chip: 'gap' },
  ].filter((row) => row.items.length > 0)

  if (skillRows.length > 0 || skills.additional.length > 0) {
    blocks.push({ key: 'skills-heading', node: <Heading spaced>Identified skills</Heading>, keepWithNext: true })
    skillRows.forEach((row, index) => {
      blocks.push({
        key: `skills-${index}`,
        node: (
          <div className="gio-block gio-skill-row">
            <span className="gio-skill-label">{row.label}</span>
            <span className="gio-skill-chips">
              {row.items.map((entry) => (
                <span className="gio-skill-verdict" key={`${row.label}-${entry.skill}`}>
                  <span className={`gio-chip ${row.chip}`.trim()}>{entry.skill}</span>
                  {entry.evidence && (
                    <span className="gio-skill-evidence">
                      “{entry.evidence}”{entry.source ? ` — ${entry.source}` : ''}
                    </span>
                  )}
                </span>
              ))}
            </span>
          </div>
        ),
      })
    })
    if (skills.additional.length > 0) {
      blocks.push({
        key: 'skills-additional',
        node: (
          <div className="gio-block gio-skill-row">
            <span className="gio-skill-label">Additional — beyond the job spec</span>
            <span className="gio-skill-chips">
              {skills.additional.map((skill) => (
                <span className="gio-chip" key={`additional-${skill}`}>{skill}</span>
              ))}
            </span>
          </div>
        ),
      })
    }
  }

  if (scorecards.length > 0) {
    blocks.push({ key: 'scorecards-heading', breakBefore: true, node: <Heading>Interview scorecards</Heading>, keepWithNext: true })
    scorecards.forEach((scorecard) => {
      blocks.push({
        key: `scorecard-${scorecard.id}`,
        node: (
          <div className="gio-block gio-scorecard">
            <div className="gio-scorecard-head">
              <div>
                <p className="gio-scorecard-name">{scorecard.interviewerName}{scorecard.interviewerRole ? <span> · {scorecard.interviewerRole}</span> : null}</p>
                <p className="gio-scorecard-meta">{scorecard.stage} · {shortDossierDate(scorecard.submittedAt)}</p>
              </div>
              <span className={`gio-scorecard-rating rating-${scorecard.rating}`}>{ratingLabel(scorecard.rating)}</span>
            </div>
            <div className="gio-scorecard-takeaways">
              <SafeHtml content={scorecard.takeawayHtml || scorecard.takeawayParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')} />
            </div>
            {!clientReady && scorecard.areas && scorecard.areas.length > 0 && (
              <div className="gio-scorecard-areas">
                {scorecard.areas.map((area) => <span key={`${scorecard.id}-${area.label}`}>{area.label} · {ratingLabel(area.rating)}</span>)}
              </div>
            )}
          </div>
        ),
      })
    })
  }

  if (workExperience.length > 0) {
    blocks.push({ key: 'exp-heading', breakBefore: scorecards.length > 0, node: <Heading spaced>Experience</Heading>, keepWithNext: true })
    groupExperience(workExperience).forEach((group, index) => {
      blocks.push({
        key: `exp-${group.companyKey}-${group.stint}-${index}`,
        node: (
          <div className="gio-block">
            <DossierExperienceGroups items={workExperience} groups={[group]} scale={0.85} showAside={false} showTopBorder={index > 0} />
          </div>
        ),
      })
    })
  }

  if (education.length > 0) {
    blocks.push({ key: 'edu-heading', node: <Heading spaced>Education</Heading>, keepWithNext: true })
    education.forEach((item, index) => {
      blocks.push({
        key: `edu-${item.id ?? index}`,
        node: (
          <div className="gio-block gio-exp">
            <div className="gio-exp-dates">
              <b>{educationYear(item) ?? ''}</b>
            </div>
            <div className="gio-exp-body">
              <p className="gio-exp-title">
                {item.degree_type || item.field_of_study || 'Education'}
                {item.institution_name && <span> · {item.institution_name}</span>}
              </p>
            </div>
          </div>
        ),
      })
    })
  }

  const detected = analysis.detected_languages
  if (detected && outputLanguageName) {
    const sources = (detected.sources || []).map((source) => `${source.label} — ${source.name}`).join(' · ')
    blocks.push({ key: 'lang-heading', node: <Heading spaced>Languages of the source material</Heading>, keepWithNext: true })
    blocks.push({
      key: 'lang',
      node: (
        <p className="gio-block gio-prose" style={{ fontSize: 10.5 }}>
          This dossier is written in {outputLanguageName}.{sources ? ` ${sources}.` : ''} Company, school, and certification names are kept as written in the source.
        </p>
      ),
    })
  }

  if (visibleDimensions.length > 0) {
    blocks.push({ key: 'dim-heading', node: <Heading spaced>Dimension breakdown</Heading>, keepWithNext: true })
    blocks.push({
      key: 'dim-head',
      keepWithNext: true,
      node: (
        <div className="gio-block gio-dim-head">
          <span className="gio-dim-name">Dimension</span>
          {!clientReady && <span className="gio-dim-weight">Weight</span>}
          <span className="gio-dim-score">Score</span>
          {!clientReady && <span className="gio-dim-points">Points</span>}
          <span className="gio-bar" style={{ background: 'transparent' }} />
        </div>
      ),
    })
    visibleDimensions.forEach((dimension, index) => {
      blocks.push({ key: `dim-${index}`, node: <DimensionTableRow dimension={dimension} clientReady={clientReady} /> })
    })
    if (!clientReady) {
      blocks.push({
        key: 'dim-total',
        node: (
          <div className="gio-block">
            <div className="gio-dim-total">
              <span style={{ flex: '1 1 auto' }}>Weighted mean of scored dimensions</span>
              <span className="gio-dim-weight">{scoredWeight}%</span>
              <span className="gio-dim-score" style={{ color: '#6f3ff5' }}>{Math.round(score)}</span>
              <span className="gio-dim-points">{contributionTotal.toFixed(1)} / {scoredWeight}</span>
              <span className="gio-bar" style={{ background: 'transparent' }} />
            </div>
            {(nullDimensions.length > 0 || score > 80) && (
              <p className="gio-note">
                {[
                  ...nullDimensions.map((dimension) => `${dimension.name} is nulled — its ${dimension.weight} points are excluded from the calculation rather than guessed.`),
                  ...(score > 80 ? ['Scores above 80 require no unresolved must-have gaps.'] : []),
                ].join(' ')}
              </p>
            )}
          </div>
        ),
      })
    }
  }

  const evidenceDimensions = visibleDimensions.filter((dimension) => (dimension.matches || []).length + (dimension.gaps || []).length > 0 || dimension.insight)
  if (includeEvidence && evidenceDimensions.length > 0) {
    blocks.push({ key: 'ev-heading', node: <Heading spaced>Evidence</Heading>, keepWithNext: true })
    evidenceDimensions.forEach((dimension, index) => {
      const weight = Number(dimension.weight) || 0
      const contribution = dimension.score === null ? null : (Number(dimension.score) * weight) / 100
      blocks.push({
        key: `ev-${index}`,
        node: (
          <div className="gio-block gio-ev-group">
            <div className="gio-ev-head">
              <span className="gio-dot" />
              <b>{dimension.name}</b>
              {dimension.score === null ? (
                <i>not assessed</i>
              ) : (
                <i>{clientReady ? dimension.score : `${dimension.score} × ${weight}% = ${contribution?.toFixed(1)} pts`}</i>
              )}
              {dimension.verdict && <span className="gio-ev-verdict">{dimension.verdict}</span>}
            </div>
            {dimension.insight && <p className="gio-ev-item neutral">{dimension.insight}</p>}
            {(dimension.matches || []).map((item, itemIndex) => (
              <p className="gio-ev-item" key={`m-${itemIndex}`}>{item}</p>
            ))}
            {(dimension.gaps || []).map((item, itemIndex) => (
              <p className="gio-ev-item gap" key={`g-${itemIndex}`}>{item}</p>
            ))}
          </div>
        ),
      })
    })
  }

  if (includeValidation && validationPoints.length > 0) {
    blocks.push({
      key: 'val-heading',
      node: <Heading spaced>{clientReady ? 'Still to verify' : 'Validation points'}</Heading>,
      keepWithNext: true,
    })
    validationPoints.forEach((point, index) => {
      const showReason = point.reason && (!clientReady || !/points?|weight|score|calculation|rubric/i.test(point.reason))
      blocks.push({
        key: `val-${index}`,
        node: (
          <div className="gio-block gio-val">
            <span className="gio-val-ring" />
            <div className="gio-val-body">
              <p className="gio-val-q">{point.question}</p>
              {showReason && <p className="gio-val-r">{point.reason}</p>}
            </div>
            <div className="gio-val-side">
              {!clientReady && point.priority && <span className={`gio-prio ${point.priority}`}>{point.priority}</span>}
              {point.suggested_stage && <span>{point.suggested_stage}</span>}
            </div>
          </div>
        ),
      })
    })
  }

  return blocks
}

function DimensionTableRow({ dimension, clientReady }: { dimension: FitDimension; clientReady: boolean }) {
  const weight = Number(dimension.weight) || 0
  const score = dimension.score
  const contribution = score === null ? null : (Number(score) * weight) / 100
  return (
    <div className="gio-block gio-dim-row">
      <span className="gio-dim-name">
        <span className="gio-dot" style={score === null ? { background: '#d5d3ca' } : undefined} />
        {dimension.name}
      </span>
      {!clientReady && <span className="gio-dim-weight">{weight}%</span>}
      <span className="gio-dim-score">{score === null ? '—' : score}</span>
      {!clientReady && (
        <span className={score === null ? 'gio-dim-points excluded' : 'gio-dim-points'}>
          {score === null ? 'excluded' : `${contribution?.toFixed(1)} / ${weight}`}
        </span>
      )}
      <span className="gio-bar">{score !== null && <div style={{ width: `${Math.max(0, Math.min(100, Number(score)))}%` }} />}</span>
    </div>
  )
}
