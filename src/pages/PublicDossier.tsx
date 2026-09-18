/**
 * /d/:token — the candidate dossier as a client sees it.
 *
 * No auth, no app rail, no internal fields. The client-ready view is resolved on
 * the server: weights, contributions, the weighted mean, rubric mechanics,
 * validation priorities and anything about compensation are removed before the
 * response is written, so there is nothing here to toggle back on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Download, Mail, ThumbsDown } from 'lucide-react'

import { EmptyAction, EmptyState } from '@/components/ui/empty-state'
import { SoftArchive } from '@/components/ui/EmptyIllustrations'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { PublicDossierBody } from '@/components/public/PublicDossierBody'
import { printDossier } from '@/components/candidates/insights/dossier/printDossier'
import type { FitAnalysis } from '@/hooks/useCandidateFitInsights'
import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { supabaseUrl, supabaseAnonKey } from '@/integrations/supabase/client'

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
  analysis: FitAnalysis
  work_experience: CandidateWorkExperience[]
  education: CandidateEducation[]
  feedback: { decision: string; created_at: string } | null
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

export default function PublicDossier() {
  const { token = '' } = useParams<{ token: string }>()
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const counted = useRef(false)

  useEffect(() => {
    let active = true
    // One read receipt per browser session, not per render.
    const sessionKey = `gio-dossier-seen-${token}`
    const countView = !sessionStorage.getItem(sessionKey)
    if (countView) sessionStorage.setItem(sessionKey, '1')
    counted.current = true

    callEndpoint({ action: 'resolve', token, count_view: countView })
      .then((result) => {
        if (!active) return
        if (result.notFound) {
          setNotFound(true)
          return
        }
        setResolved(result.data as Resolved)
        const existing = (result.data as PublicDossierPayload).feedback
        if (existing) setDecision(existing.decision)
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'This dossier could not be loaded.') })

    return () => { active = false }
  }, [token])

  const sendDecision = useCallback(async (value: 'interview_requested' | 'not_a_fit') => {
    setIsSending(true)
    setError(null)
    try {
      const result = await callEndpoint({ action: 'feedback', token, decision: value })
      if (result.notFound) throw new Error('This dossier is no longer accepting responses.')
      setDecision(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your response could not be recorded.')
    } finally {
      setIsSending(false)
    }
  }, [token])

  const live = resolved?.state === 'live' ? resolved : null

  const handleDownload = useMemo(() => {
    if (!live) return undefined
    return () => void printDossier({
      analysis: live.analysis,
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
    <PublicPageShell
      agencyName={resolved.brand.agency_name}
      logoUrl={resolved.brand.logo_url}
      pageKind="Candidate dossier"
      width={1080}
      footnote="This link is unique to you. Please don’t forward it."
    >
      <PublicDossierBody
        payload={resolved}
        decision={decision}
        isSending={isSending}
        error={error}
        onDownload={handleDownload}
        onDecision={sendDecision}
        icons={{ download: Download, notAFit: ThumbsDown, requested: CheckCircle2 }}
      />
    </PublicPageShell>
  )
}
