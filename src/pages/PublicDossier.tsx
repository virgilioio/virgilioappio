/**
 * /d/:token — the candidate dossier as a client sees it.
 *
 * No auth, no app rail, no internal fields. The client-ready view is resolved on
 * the server: weights, contributions, the weighted mean, rubric mechanics,
 * validation priorities and anything about compensation are removed before the
 * response is written, so there is nothing here to toggle back on.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  score: number
  output_language: string | null
  analysis: PublicFitAnalysis
  work_experience: CandidateWorkExperience[]
  education: CandidateEducation[]
  scorecards: DossierScorecard[]
  feedback: { decision: string; created_at: string } | null
  client_stage: {
    key: 'awaiting' | 'requested' | 'declined' | 'interviewing' | 'offer' | 'hired'
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

type Resolved = PublicDossierPayload | DeactivatedPayload

const ENDPOINT = `${supabaseUrl}/functions/v1/dossier-public`

async function callEndpoint(body: Record<string, unknown>) {
  const response = await fetch(ENDPOINT, {
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

export default function PublicDossier() {
  const { token = '' } = useParams<{ token: string }>()
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
    // One read receipt per browser session, not per render.
    const sessionKey = `gio-dossier-seen-${token}`
    const countView = !sessionStorage.getItem(sessionKey)
    if (countView) sessionStorage.setItem(sessionKey, '1')

    callEndpoint({ action: 'resolve', token, count_view: countView })
      .then((result) => {
        if (!active) return
        if (result.notFound) {
          setNotFound(true)
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
  }, [token])

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
      })
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
  }, [token])

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
        beforeCard={<PublicDossierBanner payload={resolved} />}
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
