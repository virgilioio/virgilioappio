/**
 * /d/:token — the candidate dossier as a client sees it.
 *
 * No auth, no app rail, no internal fields. The client-ready view is resolved on
 * the server: weights, contributions, the weighted mean, rubric mechanics,
 * validation priorities and anything about compensation are removed before the
 * response is written, so there is nothing here to toggle back on.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Mail } from 'lucide-react'

import { EmptyAction, EmptyState } from '@/components/ui/empty-state'
import { SoftArchive } from '@/components/ui/EmptyIllustrations'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PublicDossierBanner, PublicDossierBody } from '@/components/public/PublicDossierBody'
import { DecisionDialog, type DecisionKind } from '@/components/public/DecisionDialog'

import { printDossier } from '@/components/candidates/insights/dossier/printDossier'
import type { FitAnalysis } from '@/hooks/useCandidateFitInsights'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import type { DossierScorecard } from '@/components/candidates/insights/dossier/dossierScorecards'
import { supabaseUrl, supabaseAnonKey } from '@/integrations/supabase/client'

/**
 * The public shape is a different, smaller object than the internal analysis —
 * weights, contributions, priorities and the salary dimension are not optional
 * fields here, they simply do not exist on the wire.
 */
export interface PublicFitAnalysis {
  confidence: 'low' | 'medium' | 'high'
  profile_summary?: string
  executive_summary: string
  dimensions: Array<{
    name: string
    score: number
    insight: string | null
    matches?: string[]
    gaps?: string[]
  }>
  validation_points: Array<{ question: string; reason: string; suggested_stage: string }>
  skill_evidence?: Array<{ skill: string; status: string; evidence: string | null; source: string | null }>
  detected_languages?: { sources: Array<{ label: string; code: string; name: string }> }
}

export interface PublicDossierPayload {
  state: 'live'
  brand: { agency_name: string; logo_url: string | null }
  workspace_name: string
  prepared_by: string | null
  prepared_on: string
  job_title: string
  candidate: {
    name: string
    role_line: string | null
    location: string | null
    profile_summary: string | null
    skills: string[]
  }
  required_skills: string[]
  salary_expectation: string | null
  files?: { id: string; name: string; type: string | null; size: number | null; created_at: string; url: string }[]
  score: number
  output_language: string | null
  analysis: PublicFitAnalysis
  work_experience: CandidateWorkExperience[]
  education: CandidateEducation[]
  scorecards: DossierScorecard[]
  feedback: { decision: string; created_at: string } | null
  client_stage: {
    key: 'awaiting' | 'requested' | 'declined' | 'interviewing' | 'offer' | 'hired' | 'closed'
    occurred_at: string | null
    next_interview_at: string | null
    next_interview_label: string | null
    start_date: string | null
  }
}

interface DeactivatedPayload {
  state: 'deactivated'
  workspace_name: string
  contact_email: string | null
  brand: { agency_name: string; logo_url: string | null }
}

/** Pipeline view only: the candidate is on the board, their assessment is being prepared. */
interface PreparingPayload {
  state: 'preparing'
  workspace_name: string
  candidate_name: string
  brand: { agency_name: string; logo_url: string | null }
  pipeline?: unknown
}

type Resolved = PublicDossierPayload | DeactivatedPayload | PreparingPayload

const ENDPOINT = `${supabaseUrl}/functions/v1/dossier-public`
const PIPELINE_ENDPOINT = `${supabaseUrl}/functions/v1/pipeline-public`

async function callEndpoint(body: Record<string, unknown>, endpoint = ENDPOINT) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  })
  if (response.status === 404) return { notFound: true as const }
  if (!response.ok) throw new Error('This dossier could not be loaded.')
  return { notFound: false as const, data: await response.json() }
}

/** A candidate dossier must never be indexed, and the token must not leak in a referrer. */
function useNoIndexNoReferrer() {
  useEffect(() => {
    const tags: HTMLMetaElement[] = []
    const add = (attr: 'name', key: string, content: string) => {
      const meta = document.createElement('meta')
      meta.setAttribute(attr, key)
      meta.setAttribute('content', content)
      document.head.appendChild(meta)
      tags.push(meta)
    }
    add('name', 'robots', 'noindex, nofollow')
    add('name', 'referrer', 'no-referrer')
    return () => { tags.forEach((tag) => tag.remove()) }
  }, [])
}

export interface PipelineContext {
  token: string
  slug: string
  section: 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'
  /** Rendered above the dossier card, receives the pipeline nav info. */
  renderTop: (nav: any) => ReactNode
  onGone: () => void
}

export default function PublicDossier({ pipeline }: { pipeline?: PipelineContext } = {}) {
  const params = useParams<{ token: string }>()
  const token = pipeline ? pipeline.token : params.token ?? ''
  const endpoint = pipeline ? PIPELINE_ENDPOINT : ENDPOINT
  const extra = pipeline ? { slug: pipeline.slug, section: pipeline.section } : {}
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<string | null>(null)
  const [decisionOn, setDecisionOn] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [dialogKind, setDialogKind] = useState<DecisionKind | null>(null)
  const [pending, setPending] = useState<{ decision: string; created_at: string } | null>(null)


  useNoIndexNoReferrer()

  useEffect(() => {
    let active = true
    setResolved(null)
    setDecision(null)
    setDecisionOn(null)
    // One read receipt per browser session, not per render.
    const sessionKey = `gio-dossier-seen-${token}-${pipeline?.slug ?? ''}`
    const countView = !sessionStorage.getItem(sessionKey)
    if (countView) sessionStorage.setItem(sessionKey, '1')

    callEndpoint({ action: pipeline ? 'dossier' : 'resolve', token, count_view: countView, ...extra }, endpoint)
      .then((result) => {
        if (!active) return
        if (result.notFound) {
          if (pipeline) pipeline.onGone()
          else setNotFound(true)
          return
        }
        setResolved(result.data as Resolved)
        const existing = (result.data as PublicDossierPayload).feedback
        if (existing) {
          setDecision(existing.decision)
          setDecisionOn(existing.created_at)
        }
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'This dossier could not be loaded.') })

    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pipeline?.slug])

  // While an assessment is being prepared, check back quietly until it's ready.
  const isPreparing = resolved?.state === 'preparing'
  useEffect(() => {
    if (!isPreparing || !pipeline) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      callEndpoint({ action: 'dossier', token, ...extra }, endpoint)
        .then((result) => {
          if (result.notFound) { pipeline.onGone(); return }
          if ((result.data as Resolved).state !== 'preparing') setResolved(result.data as Resolved)
        })
        .catch(() => {})
    }, 15000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreparing, token, pipeline?.slug])

  /**
   * Called only from inside the dialog. The page stays on its awaiting state until
   * the client dismisses the recorded panel — then it re-renders into the new stage.
   */
  const submitDecision = useCallback(async (
    value: DecisionKind,
    input: { reasons: string[]; note: string },
  ) => {
    setIsSending(true)
    setError(null)
    try {
      const result = await callEndpoint({
        action: 'feedback',
        token,
        decision: value,
        reasons: input.reasons,
        note: input.note || null,
        ...extra,
      }, endpoint)
      if (result.notFound) throw new Error('This dossier is no longer accepting responses.')
      setPending({
        decision: value,
        created_at: (result.data as { created_at?: string })?.created_at ?? new Date().toISOString(),
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your response could not be recorded.')
      return false
    } finally {
      setIsSending(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pipeline?.slug])

  const closeDialog = useCallback(() => {
    setDialogKind(null)
    if (pending) {
      setDecision(pending.decision)
      setDecisionOn(pending.created_at)
      setPending(null)
    }
  }, [pending])


  const live = resolved?.state === 'live' ? resolved : null

  const handleDownload = useMemo(() => {
    if (!live) return undefined
    // The print document reads the internal analysis shape; the public payload is
    // widened locally for it, with neutral placeholders for what never arrived.
    const printAnalysis = {
      ...live.analysis,
      overall_score: live.score,
      confidence_reason: '',
      data_sources_used: [],
      data_sources_missing: [],
      dimensions: live.analysis.dimensions.map((dimension) => ({ ...dimension, weight: 0 })),
      validation_points: live.analysis.validation_points.map((point) => ({ ...point, priority: 'low' as const })),
    } as unknown as FitAnalysis

    return () => void printDossier({
      analysis: printAnalysis,
      score: live.score,
      candidateName: live.candidate.name,
      roleLine: live.candidate.role_line,
      jobTitle: live.job_title || null,
      location: live.candidate.location,
      contactItems: [],
      requiredSkills: live.required_skills,
      candidateSkills: live.candidate.skills,
      workExperience: live.work_experience,
      education: live.education,
      scorecards: live.scorecards,
      outputLanguageName: null,
      clientReady: true,
      includeContact: false,
      includeEvidence: true,
      includeValidation: true,
      pageSize: 'a4',
      preparedBy: live.prepared_by,
      preparedOn: new Date(live.prepared_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    }, live.candidate.name)
  }, [live])

  if (notFound) {
    // A token that was never issued behaves like any other unknown address.
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF8F3' }}>
        <p className="font-inter" style={{ fontSize: 13, color: '#8B8F9E' }}>404 — page not found</p>
      </div>
    )
  }

  if (!resolved) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#FAF8F3' }}>
        <p className="font-inter" style={{ fontSize: 13, color: '#8B8F9E' }}>
          {error ?? 'Opening the dossier…'}
        </p>
      </div>
    )
  }

  if (resolved.state === 'preparing') {
    return (
      <PublicPageShell
        agencyName={resolved.brand.agency_name}
        logoUrl={resolved.brand.logo_url}
        pageKind="Candidate dossier"
        width={760}
      >
        {pipeline?.renderTop(resolved.pipeline)}
        <div className="flex flex-col items-center text-center" style={{ padding: '72px 20px', margin: '0 auto', maxWidth: 440 }}>
          <span aria-hidden className="animate-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: '#7C5CFF', marginBottom: 16 }} />
          <h1 className="font-poppins" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: '#1F2230' }}>
            Assessment in progress
          </h1>
          <p className="font-inter" style={{ fontSize: 13, color: '#5A6072', marginTop: 8, lineHeight: 1.55 }}>
            {`${resolved.workspace_name} is preparing ${resolved.candidate_name}’s dossier. It usually takes a minute or two — this page will update on its own.`}
          </p>
        </div>
      </PublicPageShell>
    )
  }

  if (resolved.state === 'deactivated') {
    const workspace = resolved.workspace_name
    return (
      <PublicPageShell
        agencyName={resolved.brand.agency_name}
        logoUrl={resolved.brand.logo_url}
        pageKind="Candidate dossier"
        width={760}
        footnote="This link has been closed by the agency that shared it."
      >
        <EmptyState
          illustration={<SoftArchive />}
          size="route"
          title="This dossier is no longer available"
          body={`The candidate has left this process, or the role has closed. ${workspace} can tell you where things stand.`}
          primary={
            resolved.contact_email
              ? (
                <EmptyAction
                  icon={<Mail size={16} />}
                  onClick={() => { window.location.href = `mailto:${resolved.contact_email}` }}
                >
                  {`Contact ${workspace}`}
                </EmptyAction>
              )
              : undefined
          }
        />
      </PublicPageShell>
    )
  }

  return (
    <>
      <PublicPageShell
        agencyName={resolved.brand.agency_name}
        logoUrl={resolved.brand.logo_url}
        pageKind="Candidate dossier"
        width={1080}
        footnote={`Confidential — shared with you by ${resolved.workspace_name}`}
        beforeCard={
          <>
            {pipeline && pipeline.renderTop((resolved as any).pipeline)}
            <PublicDossierBanner payload={resolved} />
          </>
        }
      >
        <PublicDossierBody
          payload={resolved}
          decision={decision}
          decisionOn={decisionOn}
          isSending={isSending}
          error={error}
          onDownload={handleDownload}
          onDecision={setDialogKind}
        />
      </PublicPageShell>
      {dialogKind && (
        <DecisionDialog
          kind={dialogKind}
          candidateFirstName={resolved.candidate.name.split(' ')[0] || resolved.candidate.name}
          recruiterName={resolved.prepared_by || resolved.workspace_name}
          workspaceName={resolved.workspace_name}
          onClose={closeDialog}
          onSubmit={(input) => submitDecision(dialogKind, input)}
        />
      )}
    </>
  )

}
