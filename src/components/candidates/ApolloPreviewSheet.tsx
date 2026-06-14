import { useState, useEffect, useMemo } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import {
  ChevronLeft, ChevronRight, X, MoreHorizontal, ThumbsDown, Bookmark,
  Mail, Phone, Lock, Briefcase, Wrench, MapPin, Building2,
  CheckCircle2, ExternalLink, Check, Info, Globe, Users, DollarSign,
  IdCard, Clock, Hash, Database, RefreshCw, TrendingUp,
  GraduationCap, Copy, Sparkles, Linkedin, UserPlus,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { JobSelectionDialog } from '@/components/sourcing/JobSelectionDialog'
import { calculateFitScore, type FitScore } from '@/lib/candidateFitScoring'
import { useCandidatePreviewStatus } from '@/hooks/useCandidatePreviewStatus'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import type { SearchCriteria } from '@/types/sourcing'
import { cn } from '@/lib/utils'

interface ApolloPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId?: string | null
  apolloId?: string | null
  apolloData?: {
    candidate_name?: string
    full_name?: string
    headline?: string
    location?: string
    current_company?: string
    current_role?: string
    linkedin_url?: string
    apollo_score?: number
    email?: string
    email_status?: string
    phone?: string
    industry?: string
    connections_count?: number
    follower_count?: number
    company_url?: string
    company_website?: string
    company_industry?: string
    experience_location?: string
    has_email?: boolean
    has_phone?: boolean
    has_location?: boolean
    last_refreshed_at?: string
    seniority?: string
    departments?: string[]
  }
  jobId?: string | null
  projectId?: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onCandidateCollected?: (candidateId: string) => void
  searchCriteria?: SearchCriteria
  jobTitle?: string | null
}

interface EmploymentHistoryItem {
  company: string
  title: string
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean
  description?: string | null
}

interface EnrichedCandidateData {
  candidate_id: string
  candidate_name: string
  linkedin_url?: string
  email?: string
  phone?: string
  location_city?: string
  location_state?: string
  location_country?: string
  skills?: string[]
  profile_summary?: string
  // Apollo signals + post-collect extras
  headline?: string | null
  email_status?: string | null
  seniority?: string | null
  departments?: string[] | null
  contact_emails?: Array<{ type?: string; email: string; status?: string | null }> | null
  contact_phones?: Array<{ type?: string; number: string; raw_number?: string | null }> | null
  apollo_collected_at?: string | null
  role_current?: string | null
  company_current?: string | null
  employment_history?: EmploymentHistoryItem[]
}

/* ============================================================================
 * Pre-collect subcomponents
 * ========================================================================== */

function CardShell({
  title,
  caption,
  icon: Icon,
  children,
}: {
  title: string
  caption?: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-xl border border-border bg-surface-primary shadow-none">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-virgilio-purple" strokeWidth={2.2} />}
          <h3 className="font-poppins font-semibold text-[14px] tracking-[-0.01em] text-text-primary">
            {title}
          </h3>
        </div>
        {caption && (
          <span className="text-[11px] text-text-tertiary">{caption}</span>
        )}
      </div>
      <CardContent className="px-5 pb-5 pt-0">{children}</CardContent>
    </Card>
  )
}

function KnownFieldRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType
  label: string
  value: string | React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" strokeWidth={2} />
      <span className="text-[12px] text-text-tertiary w-[88px] flex-shrink-0">{label}</span>
      <span className={cn(
        "text-[13px] text-text-primary truncate",
        mono && "font-mono text-[12.5px]"
      )}>
        {value}
      </span>
    </div>
  )
}

type MatchKind = 'match' | 'partial' | 'inferred' | 'miss'

function MatchBadge({ kind }: { kind: MatchKind }) {
  switch (kind) {
    case 'match':
      return <Badge tone="green" dot>Match</Badge>
    case 'partial':
      return <Badge tone="yellow" dot>Partial</Badge>
    case 'inferred':
      return <Badge tone="lilac" dot>Inferred</Badge>
    case 'miss':
    default:
      return <Badge tone="neutral" dot>No match</Badge>
  }
}

const MATCH_ICON_TONE: Record<MatchKind, string> = {
  match: 'text-pastel-green-foreground',
  partial: 'text-pastel-yellow-foreground',
  inferred: 'text-badge-lilac-foreground',
  miss: 'text-text-tertiary',
}

function MatchRow({
  icon: Icon,
  label,
  value,
  kind,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  kind: MatchKind
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <Icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", MATCH_ICON_TONE[kind])} strokeWidth={2} />
        <div className="min-w-0">
          <div className="text-[11px] text-text-tertiary uppercase tracking-[0.06em] font-medium">{label}</div>
          <div className="text-[13px] text-text-primary mt-0.5 leading-snug">{value}</div>
        </div>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <MatchBadge kind={kind} />
      </div>
    </div>
  )
}

function KeywordBadge({ label, matched }: { label: string; matched: boolean }) {
  return matched
    ? <Badge tone="green" icon={Check}>{label}</Badge>
    : <Badge tone="neutral" bordered>{label}</Badge>
}

function AvailabilityFieldCard({
  icon: Icon,
  label,
  sublabel,
  available,
}: {
  icon: React.ElementType
  label: string
  sublabel?: string
  available: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-primary px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
          available
            ? "bg-pastel-green text-pastel-green-foreground"
            : "bg-muted text-text-tertiary"
        )}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-poppins font-medium text-text-primary truncate leading-tight">{label}</div>
          {sublabel && (
            <div className="text-[10.5px] text-text-tertiary truncate mt-0.5">{sublabel}</div>
          )}
        </div>
      </div>
      {available
        ? <Badge tone="green" dot size="xs">Available</Badge>
        : <Badge tone="neutral" size="xs">Not in record</Badge>}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary mt-4 mb-2 first:mt-0">
      {children}
    </div>
  )
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

function splitName(fullName: string): { first: string; last: string; lastObfuscated: string } {
  const trimmed = (fullName || '').trim()
  const parts = trimmed.split(/\s+/)
  const first = parts[0] || ''
  const last = parts.slice(1).join(' ') || ''
  let lastObfuscated = last
  if (last && !last.includes('*')) {
    lastObfuscated = last.length <= 2
      ? `${last[0]}***`
      : `${last[0]}***${last.slice(-1)}`
  }
  return { first, last, lastObfuscated }
}

function daysAgoLabel(iso?: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  const days = Math.max(1, Math.round(ms / 86_400_000))
  return `${days}d ago`
}

function conciseAgo(iso?: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function formatMonthYear(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`.replace(/^(\d{2})\/(\d{4})$/, '$2-$1')
}

function shortApolloId(id?: string | null): string {
  if (!id) return '—'
  return id.length > 6 ? id.slice(-6) : id
}

function matchesKeyword(needle: string, haystacks: (string | undefined)[]): boolean {
  const n = needle.toLowerCase().trim()
  if (!n) return false
  return haystacks.some(h => typeof h === 'string' && h.toLowerCase().includes(n))
}

/* ============================================================================
 * Main component
 * ========================================================================== */

export function ApolloPreviewSheet({
  open,
  onOpenChange,
  apolloId,
  apolloData,
  jobId,
  projectId,
  hasPrev,
  hasNext,
  onNavigatePrev,
  onNavigateNext,
  onCandidateCollected,
  searchCriteria,
  jobTitle,
}: ApolloPreviewSheetProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectedCandidateId, setCollectedCandidateId] = useState<string | null>(null)
  const [collectedJobId, setCollectedJobId] = useState<string | null>(null)
  const [showJobSelection, setShowJobSelection] = useState(false)
  const [enrichedData, setEnrichedData] = useState<EnrichedCandidateData | null>(null)
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<'idle' | 'checking' | 'done'>('idle')
  const [firstStageInfo, setFirstStageInfo] = useState<{ id: string; name: string } | null>(null)
  const { isCollectDisabled } = useSourcingCreditWarnings()
  const { shortlistCandidate, markNotAFit, isUpdating, currentApolloId } = useCandidatePreviewStatus()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { data: creditsData } = useSourcingCredits()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchFirstStage() {
      if (!jobId) { setFirstStageInfo(null); return }
      try {
        const stages = await loadHiringPlanInstances(jobId)
        if (stages.length > 0) {
          const firstStage = stages[0]
          setFirstStageInfo({
            id: firstStage.jhsId,
            name: firstStage.customStageName || firstStage.stage.stage_name
          })
        }
      } catch (error) {
        console.error('Failed to load first stage:', error)
      }
    }
    fetchFirstStage()
  }, [jobId, loadHiringPlanInstances])

  useEffect(() => {
    setCollectedCandidateId(null)
    setCollectedJobId(null)
    setPhoneCheckStatus('idle')
    setEnrichedData(null)
  }, [apolloId])

  // Auto-hydrate from DB when an Apollo profile has already been collected.
  // Without this, opening a previously-collected row shows the obfuscated preview
  // (because enrichedData is only populated by the in-sheet collect button).
  useEffect(() => {
    if (!open || !apolloId || enrichedData) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: candidateData } = await supabase
          .from('candidates')
          .select('id, candidate_name, linkedin_url, email, phone, location_city, location_state, location_country, skills, profile_summary, email_status, bio, contact_emails, contact_phones, role_current, company_current, apollo_collected_at')
          .eq('apollo_id', apolloId)
          .maybeSingle()
        if (cancelled || !candidateData || !candidateData.apollo_collected_at) return
        const { data: workExp } = await supabase
          .from('candidate_work_experience')
          .select('company_name, job_title, start_date, end_date, is_current, description')
          .eq('candidate_id', candidateData.id)
          .order('is_current', { ascending: false })
          .order('start_date', { ascending: false })
        if (cancelled) return
        const dbHistory: EmploymentHistoryItem[] = (workExp || []).map((r: any) => ({
          company: r.company_name || 'Unknown Company',
          title: r.job_title || '',
          start_date: r.start_date,
          end_date: r.end_date,
          is_current: !!r.is_current,
          description: r.description || null,
        }))
        setCollectedCandidateId(candidateData.id)
        setEnrichedData({
          candidate_id: candidateData.id,
          candidate_name: candidateData.candidate_name,
          linkedin_url: candidateData.linkedin_url || undefined,
          email: candidateData.email || undefined,
          phone: candidateData.phone || undefined,
          location_city: candidateData.location_city || undefined,
          location_state: candidateData.location_state || undefined,
          location_country: candidateData.location_country || undefined,
          skills: candidateData.skills || undefined,
          profile_summary: candidateData.profile_summary || undefined,
          headline: candidateData.bio || null,
          email_status: candidateData.email_status || null,
          seniority: null,
          departments: null,
          contact_emails: (candidateData.contact_emails as any) || null,
          contact_phones: (candidateData.contact_phones as any) || null,
          apollo_collected_at: candidateData.apollo_collected_at,
          role_current: candidateData.role_current || apolloData?.current_role || null,
          company_current: candidateData.company_current || apolloData?.current_company || null,
          employment_history: dbHistory,
        })
      } catch (err) {
        console.warn('[ApolloPreviewSheet] auto-hydrate failed:', err)
      }
    })()
    return () => { cancelled = true }
  }, [open, apolloId, enrichedData, apolloData?.current_role, apolloData?.current_company])

  useEffect(() => {
    if (!enrichedData?.candidate_id || enrichedData?.phone || !apolloData?.has_phone) return
    setPhoneCheckStatus('checking')
    let attempts = 0
    const maxAttempts = 4
    const intervals = [2000, 3000, 5000, 8000]
    const pollForPhone = async () => {
      if (attempts >= maxAttempts) { setPhoneCheckStatus('done'); return }
      const delay = intervals[attempts] || 5000
      attempts++
      await new Promise(r => setTimeout(r, delay))
      try {
        const { data: candidateData } = await supabase
          .from('candidates').select('phone').eq('id', enrichedData.candidate_id).single()
        if (candidateData?.phone) {
          setEnrichedData(prev => prev ? { ...prev, phone: candidateData.phone } : prev)
          setPhoneCheckStatus('done'); return
        }
        pollForPhone()
      } catch { setPhoneCheckStatus('done') }
    }
    pollForPhone()
  }, [enrichedData?.candidate_id, enrichedData?.phone, apolloData?.has_phone])

  const fitScore: FitScore = useMemo(() => {
    if (!apolloData) {
      return { overall: 50, roleAlignment: 'medium', skillsMatch: 'medium', locationMatch: 'medium', confidence: 0, dataRichness: 0 }
    }
    return calculateFitScore({ ...apolloData, candidate_name: apolloData.candidate_name || apolloData.full_name || '' }, searchCriteria)
  }, [apolloData, searchCriteria])

  const keywordMatches = useMemo(() => {
    const keywords: string[] = (
      searchCriteria?.skills?.length
        ? searchCriteria.skills
        : searchCriteria?.title_keywords ?? []
    ).slice(0, 8)
    const haystacks = [
      apolloData?.current_role,
      apolloData?.headline,
      apolloData?.current_company,
      apolloData?.industry,
      apolloData?.company_industry,
    ]
    const items = keywords.map(k => ({ label: k, matched: matchesKeyword(k, haystacks) }))
    const matched = items.filter(i => i.matched).length
    return { items, matched, total: items.length }
  }, [searchCriteria, apolloData])

  const roleMatchKind: 'match' | 'partial' | 'inferred' | 'miss' = useMemo(() => {
    const target = searchCriteria?.title_keywords?.[0]
    const role = apolloData?.current_role
    if (!role) return 'inferred'
    if (!target) return 'inferred'
    if (role.toLowerCase().includes(target.toLowerCase())) return 'match'
    const tWords = target.toLowerCase().split(/\s+/)
    const rWords = role.toLowerCase().split(/\s+/)
    return tWords.some(w => w.length > 3 && rWords.includes(w)) ? 'partial' : 'miss'
  }, [apolloData?.current_role, searchCriteria?.title_keywords])

  const handleCollectProfile = async (
    selectedJobId?: string,
    selectedJobName?: string,
    selectedStageId?: string,
    selectedStageName?: string
  ) => {
    if (!apolloId) return
    setIsCollecting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const jobIdToUse = selectedJobId || jobId
      const { data, error } = await supabase.functions.invoke('enrich-apollo-profile', {
        body: { apollo_id: apolloId, job_id: jobIdToUse, stage_id: selectedStageId, user_id: user?.id }
      })
      if (error) throw error
      const collectedResult = data?.results?.[0]
      const candidateId = collectedResult?.candidate_id
      const wasAlreadyCollected = collectedResult?.already_collected
      if (candidateId) {
        setCollectedCandidateId(candidateId)
        const [{ data: candidateData }, { data: workExp }] = await Promise.all([
          supabase.from('candidates')
            .select('id, candidate_name, linkedin_url, email, phone, location_city, location_state, location_country, skills, profile_summary, email_status, bio, contact_emails, contact_phones, role_current, company_current, apollo_collected_at')
            .eq('id', candidateId).single(),
          supabase.from('candidate_work_experience')
            .select('company_name, job_title, start_date, end_date, is_current, description')
            .eq('candidate_id', candidateId)
            .order('is_current', { ascending: false })
            .order('start_date', { ascending: false }),
        ])
        if (candidateData) {
          // Prefer fresh Apollo response signals (carry the in-session enrichment),
          // fall back to persisted fields when missing (already-collected branch).
          const apolloSignalsHistory: EmploymentHistoryItem[] | undefined =
            Array.isArray(collectedResult?.employment_history)
              ? collectedResult.employment_history.map((e: any) => ({
                  company: e.organization_name || 'Unknown Company',
                  title: e.title || '',
                  start_date: e.start_date || null,
                  end_date: e.end_date || null,
                  is_current: !!e.current,
                  description: e.description || null,
                }))
              : undefined
          const dbHistory: EmploymentHistoryItem[] = (workExp || []).map((r: any) => ({
            company: r.company_name || 'Unknown Company',
            title: r.job_title || '',
            start_date: r.start_date,
            end_date: r.end_date,
            is_current: !!r.is_current,
            description: r.description || null,
          }))
          setEnrichedData({
            candidate_id: candidateData.id,
            candidate_name: candidateData.candidate_name,
            linkedin_url: candidateData.linkedin_url || undefined,
            email: candidateData.email || undefined,
            phone: candidateData.phone || undefined,
            location_city: candidateData.location_city || undefined,
            location_state: candidateData.location_state || undefined,
            location_country: candidateData.location_country || undefined,
            skills: candidateData.skills || undefined,
            profile_summary: candidateData.profile_summary || undefined,
            headline: collectedResult?.headline || candidateData.bio || null,
            email_status: collectedResult?.email_status || candidateData.email_status || null,
            seniority: collectedResult?.seniority || null,
            departments: collectedResult?.departments || null,
            contact_emails: (candidateData.contact_emails as any) || null,
            contact_phones: (candidateData.contact_phones as any) || null,
            apollo_collected_at: candidateData.apollo_collected_at || collectedResult?.apollo_collected_at || null,
            role_current: candidateData.role_current || apolloData?.current_role || null,
            company_current: candidateData.company_current || apolloData?.current_company || null,
            employment_history: apolloSignalsHistory && apolloSignalsHistory.length > 0 ? apolloSignalsHistory : dbHistory,
          })
          setCollectedJobId(jobIdToUse || null)
        }
        toast({
          title: 'Profile Collected',
          description: wasAlreadyCollected
            ? jobIdToUse ? `Profile was already in your database and has been added to ${selectedJobName || 'the job'}` : 'Profile was already in your database'
            : jobIdToUse ? `Successfully added to ${selectedJobName || 'job'} at stage "${selectedStageName || 'Unknown'}"` : 'Full profile data is now available',
        })
        queryClient.invalidateQueries({ queryKey: ['sourcing-preview-candidates'] })
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['sourcing-credits'] })
        queryClient.invalidateQueries({ queryKey: ['saved-candidates'] })
        onCandidateCollected?.(candidateId)
      }
    } catch (error: any) {
      toast({ title: 'Collection Failed', description: error.message || 'Failed to collect full profile', variant: 'destructive' })
    } finally {
      setIsCollecting(false)
    }
  }

  const handleJobSelected = (jId: string, jobName: string, stageId?: string, stageName?: string) => {
    setShowJobSelection(false)
    handleCollectProfile(jId, jobName, stageId, stageName)
  }

  const handleNavigatePrev = () => {
    setEnrichedData(null); setCollectedCandidateId(null); onNavigatePrev?.()
  }
  const handleNavigateNext = () => {
    setEnrichedData(null); setCollectedCandidateId(null); onNavigateNext?.()
  }
  const handleShortlist = () => { if (apolloId && projectId) shortlistCandidate(apolloId, projectId) }
  const handleNotAFit = () => { if (apolloId && projectId) markNotAFit(apolloId, projectId) }

  const triggerCollect = () => {
    if (!jobId) setShowJobSelection(true)
    else handleCollectProfile(jobId, jobTitle || undefined, firstStageInfo?.id, firstStageInfo?.name)
  }

  const hasEmailAvailable = apolloData?.has_email ?? false
  const hasPhoneAvailable = apolloData?.has_phone ?? false
  const incomingName = apolloData?.candidate_name || apolloData?.full_name
  const looksRevealed = !!incomingName && !incomingName.includes('*')
  const isCollected = !!enrichedData || looksRevealed
  const rawName = enrichedData?.candidate_name || incomingName || 'Unknown Candidate'
  const { first: firstName, lastObfuscated } = splitName(rawName)
  const displayName = isCollected
    ? rawName
    : `${firstName}${lastObfuscated ? ' ' + lastObfuscated : ''}`
  const initial = (firstName[0] || '?').toUpperCase()
  const refreshedLabel = daysAgoLabel(apolloData?.last_refreshed_at)

  const fitColor = fitScore.overall >= 75
    ? 'text-green-600'
    : fitScore.overall >= 50
      ? 'text-amber-600'
      : 'text-text-tertiary'

  const enrichedLocation = enrichedData
    ? [enrichedData.location_city, enrichedData.location_state, enrichedData.location_country].filter(Boolean).join(', ')
    : null

  const TopBar = (
    <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-surface-primary flex-shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleNavigatePrev} disabled={!hasPrev} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleNavigateNext} disabled={!hasNext} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {jobTitle && (
          <span className="text-[12.5px] text-text-secondary truncate ml-2">
            <span className="text-text-tertiary">·</span> {jobTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isCollected && projectId && (
          <>
            <Button
              variant="ghost" size="sm"
              className="h-8 px-2.5 text-[12.5px] text-text-secondary hover:text-red-600"
              onClick={handleNotAFit}
              disabled={isUpdating && currentApolloId === apolloId}
            >
              <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
              Not a fit
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-8 px-2.5 text-[12.5px] text-text-secondary"
              onClick={handleShortlist}
              disabled={isUpdating && currentApolloId === apolloId}
            >
              <Bookmark className="h-3.5 w-3.5 mr-1.5" />
              Save for later
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="More">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const IdentityBlock = (
    <div className="flex items-start gap-4 px-6 pt-5 pb-5 border-b border-border bg-surface-primary">
      <div className="h-12 w-12 rounded-full bg-surface-secondary flex items-center justify-center flex-shrink-0 font-poppins font-semibold text-[18px] text-text-secondary">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-poppins font-semibold tracking-[-0.02em] text-text-primary text-[22px] leading-tight">
            {displayName}
          </h2>
          {!isCollected ? (
            <span className="inline-flex items-center gap-1 px-2 h-[22px] rounded-md bg-virgilio-purple/10 text-virgilio-purple border border-virgilio-purple/20 text-[11px] font-poppins font-medium">
              <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
              Preview · pre-collect
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 h-[22px] rounded-md bg-green-50 text-green-700 border border-green-200 text-[11px] font-poppins font-medium">
              <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
              Collected
            </span>
          )}
          {(enrichedData?.linkedin_url || apolloData?.linkedin_url) && (
            <button
              onClick={() => window.open(enrichedData?.linkedin_url || apolloData?.linkedin_url, '_blank')}
              className="ml-1 text-text-tertiary hover:text-blue-600"
              aria-label="Open LinkedIn"
            >
              <LinkedInFilled className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {(enrichedData?.role_current || apolloData?.current_role || apolloData?.current_company) && (
          <p className="text-[14px] text-text-secondary mt-1">
            {enrichedData?.role_current || apolloData?.current_role}
            {(enrichedData?.company_current || apolloData?.current_company) && (
              <> at <span className="text-text-primary font-medium">{enrichedData?.company_current || apolloData?.current_company}</span></>
            )}
          </p>
        )}
        {isCollected && enrichedData?.headline && (
          <p className="italic text-[13px] text-text-secondary mt-1.5 leading-snug">
            "{enrichedData.headline}"
          </p>
        )}
        {isCollected ? (
          <div className="flex items-center gap-x-3 gap-y-1.5 mt-2 text-[11.5px] text-text-tertiary flex-wrap">
            {(enrichedData?.location_city || enrichedData?.location_state || enrichedData?.location_country) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[enrichedData?.location_city, enrichedData?.location_state, enrichedData?.location_country].filter(Boolean).join(', ')}
              </span>
            )}
            {enrichedData?.seniority && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span className="capitalize text-text-secondary">{enrichedData.seniority}</span>
                </span>
              </>
            )}
            {enrichedData?.departments && enrichedData.departments.length > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  <span className="capitalize text-text-secondary">{enrichedData.departments.join(' · ')}</span>
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2 text-[11.5px] text-text-tertiary flex-wrap">
            <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" /> Source: Apollo</span>
            {refreshedLabel && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Apollo refreshed {refreshedLabel}</span>
              </>
            )}
            {apolloId && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> apollo_id <span className="font-mono">{shortApolloId(apolloId)}</span></span>
              </>
            )}
          </div>
        )}
      </div>
      {keywordMatches.total > 0 && (
        <div className="flex-shrink-0 text-right border border-border rounded-lg px-3 py-2 bg-surface-secondary/40">
          <div className="text-[9.5px] uppercase tracking-[0.1em] text-text-tertiary font-medium">Keyword fit</div>
          <div className={cn("font-poppins font-semibold text-[26px] leading-none mt-0.5", fitColor)}>
            {fitScore.overall}
          </div>
          <div className="text-[10.5px] text-text-tertiary mt-1">
            {keywordMatches.matched} of {keywordMatches.total} keywords
          </div>
        </div>
      )}
    </div>
  )

  const PreCollectBody = (
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-surface-secondary/30">
      <CardShell title="What we know now" caption="From Apollo search · 6 fields">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
          <KnownFieldRow icon={IdCard} label="First name" value={firstName || '—'} />
          <KnownFieldRow icon={IdCard} label="Last name" value={
            <span>{lastObfuscated || '—'}<span className="text-text-tertiary"> (obfuscated)</span></span>
          } />
          <KnownFieldRow icon={Briefcase} label="Title" value={apolloData?.current_role || '—'} />
          <KnownFieldRow icon={Building2} label="Company" value={apolloData?.current_company || '—'} />
          <KnownFieldRow icon={Database} label="Source" value="Apollo" />
          <KnownFieldRow icon={Clock} label="Refreshed" value={refreshedLabel || 'Unknown'} />
        </div>
        <div className="mt-3 px-3 py-2.5 rounded-lg bg-surface-secondary/60 text-[12px] text-text-secondary leading-relaxed">
          <span className="font-medium text-text-primary">That's it.</span> Apollo's search endpoint is intentionally lean — last name, exact location, LinkedIn URL, email, phone, employment history, seniority and departments are all gated behind enrichment.
        </div>
      </CardShell>

      <CardShell title="How they match the search" caption="Computed locally" icon={Sparkles}>
        <div className="divide-y divide-border/60">
          <MatchRow
            icon={Briefcase}
            label="Role"
            value={
              <>
                {apolloData?.current_role || 'Unknown role'}
                {searchCriteria?.title_keywords?.[0] && (
                  <span className="text-text-tertiary"> (search asks for {searchCriteria.title_keywords[0]})</span>
                )}
              </>
            }
            kind={roleMatchKind}
          />
          <MatchRow
            icon={Building2}
            label="Company"
            value={
              <>
                {apolloData?.current_company || 'Unknown'}
                <span className="text-text-tertiary"> · industry hint available on enrichment</span>
              </>
            }
            kind="inferred"
          />
          <MatchRow
            icon={MapPin}
            label="Location"
            value={
              apolloData?.has_location ?? apolloData?.location
                ? <>City available <span className="text-text-tertiary">· exact text hidden until collect</span></>
                : <span className="text-text-tertiary">Not in Apollo search response</span>
            }
            kind={apolloData?.has_location || apolloData?.location ? 'inferred' : 'miss'}
          />
        </div>
        {keywordMatches.total > 0 && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary mb-2.5">
              Keyword matches ({keywordMatches.matched} of {keywordMatches.total})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywordMatches.items.map((kw, i) => (
                <KeywordBadge key={i} label={kw.label} matched={kw.matched} />
              ))}
            </div>
          </div>
        )}
      </CardShell>

      <CardShell title="What you'll get on collect" caption="Apollo says: yes / no" icon={Lock}>
        <GroupLabel>Person</GroupLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AvailabilityFieldCard icon={Mail} label="Verified work email" available={hasEmailAvailable} />
          <AvailabilityFieldCard icon={Phone} label="Direct mobile phone" sublabel="Delivered async via webhook" available={hasPhoneAvailable} />
          <AvailabilityFieldCard icon={MapPin} label="Exact city + state" available={apolloData?.has_location ?? true} />
          <AvailabilityFieldCard icon={Globe} label="Country" available={true} />
        </div>

        <GroupLabel>Company</GroupLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AvailabilityFieldCard icon={TrendingUp} label="Industry" available={true} />
          <AvailabilityFieldCard icon={Users} label="Employee count" available={true} />
          <AvailabilityFieldCard icon={DollarSign} label="Revenue band" available={false} />
          <AvailabilityFieldCard icon={Phone} label="Company phone" available={true} />
        </div>

        <GroupLabel>Always returned on enrichment</GroupLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AvailabilityFieldCard icon={IdCard} label="Real last name" available={true} />
          <AvailabilityFieldCard icon={Linkedin} label="LinkedIn URL" available={true} />
          <AvailabilityFieldCard icon={Briefcase} label="Full work history + descriptions" sublabel="Every role · titles, dates, summaries" available={true} />
          <AvailabilityFieldCard icon={Wrench} label="Seniority + departments" sublabel="Normalized levels & function tags" available={true} />
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/60 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-amber-900 leading-relaxed">
            <span className="font-medium">Apollo doesn't return education, photo, GitHub or Twitter</span> in this endpoint. Resume, scorecards and Gio signals come once the candidate is in your job's pipeline.
          </p>
        </div>
      </CardShell>
    </div>
  )

  const collectableCount = 12
  const remainingCredits = creditsData
    ? Math.max(0, (creditsData.collect_credits_limit - creditsData.collect_credits_used) + (creditsData.bonus_credits_available ?? 0))
    : null
  const PreCollectFooter = (
    <div className="border-t border-virgilio-border bg-[#F6F5F1]/95 backdrop-blur px-6 sm:px-10 py-4 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={handleNavigateNext} disabled={!hasNext} type="button">
          Skip
        </Button>
        <p className="hidden sm:block text-[12px] text-text-tertiary">
          Uses <span className="text-text-primary font-medium">1 credit</span>
          {remainingCredits !== null && (
            <> · {remainingCredits} remaining this month</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={triggerCollect}
          disabled={isCollecting || isCollectDisabled}
          loading={isCollecting}
          icon={Lock}
        >
          Collect · 1 credit
        </Button>
      </div>
    </div>
  )

  const personalEmails = (enrichedData?.contact_emails || []).filter(
    e => e?.email && e.email !== enrichedData?.email && (e.type === 'personal' || e.type !== 'work')
  )
  const linkedinHandle = enrichedData?.linkedin_url?.replace(/^https?:\/\/(www\.)?linkedin\.com\//i, 'linkedin.com/')
  const collectedAgo = conciseAgo(enrichedData?.apollo_collected_at)
  const apolloRefreshedAgo = refreshedLabel

  const PostCollectBody = (
    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-surface-secondary/30">
      {/* Contact strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Work email */}
        <div className="rounded-xl border border-border bg-surface-primary p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary">
              <Mail className="h-3 w-3" /> Work email
            </div>
            {enrichedData?.email_status === 'verified' && (
              <Badge tone="green" size="xs" dot>Verified</Badge>
            )}
          </div>
          {enrichedData?.email ? (
            <>
              <div className="flex items-center gap-1.5 min-w-0">
                <a href={`mailto:${enrichedData.email}`} className="text-[13px] text-text-primary hover:underline truncate font-medium">
                  {enrichedData.email}
                </a>
                <button
                  className="text-text-tertiary hover:text-text-secondary flex-shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(enrichedData.email!)
                    toast({ title: 'Copied', description: 'Email copied to clipboard' })
                  }}
                  aria-label="Copy email"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              {personalEmails.length > 0 && (
                <div className="text-[11.5px] text-text-tertiary mt-1.5 truncate">
                  + {personalEmails.length} personal: {personalEmails[0].email}
                </div>
              )}
            </>
          ) : (
            <span className="text-[12.5px] text-text-tertiary">Not in record</span>
          )}
        </div>

        {/* Mobile */}
        <div className="rounded-xl border border-border bg-surface-primary p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary">
              <Phone className="h-3 w-3" /> Mobile
            </div>
            {enrichedData?.phone && <Badge tone="green" size="xs" dot>Delivered</Badge>}
          </div>
          {enrichedData?.phone ? (
            <>
              <a href={`tel:${enrichedData.phone}`} className="text-[13px] text-text-primary hover:underline font-medium">
                {enrichedData.phone}
              </a>
              <div className="text-[11.5px] text-text-tertiary mt-1.5">
                From Apollo phone webhook{collectedAgo ? ` · ${collectedAgo}` : ''}
              </div>
            </>
          ) : phoneCheckStatus === 'checking' ? (
            <span className="text-[12.5px] text-amber-600 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
              Checking for phone…
            </span>
          ) : (
            <span className="text-[12.5px] text-text-tertiary">Phone not available</span>
          )}
        </div>

        {/* LinkedIn */}
        <div className="rounded-xl border border-border bg-surface-primary p-4">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary mb-2">
            <LinkedInFilled className="h-3 w-3" /> LinkedIn
          </div>
          {enrichedData?.linkedin_url ? (
            <>
              <a
                href={enrichedData.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="block text-[13px] text-text-primary hover:underline truncate font-medium"
              >
                {linkedinHandle || enrichedData.linkedin_url}
              </a>
              <div className="text-[11.5px] text-text-tertiary mt-1.5 font-mono truncate">linkedin_url</div>
            </>
          ) : (
            <span className="text-[12.5px] text-text-tertiary">Not in record</span>
          )}
        </div>
      </div>

      {/* Apollo signals */}
      {(enrichedData?.seniority || (enrichedData?.departments && enrichedData.departments.length > 0) || enrichedData?.email_status) && (
        <CardShell title="Apollo signals" caption="Normalized by Apollo">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary mb-2">Seniority</div>
              {enrichedData?.seniority
                ? <Badge tone="lilac" size="sm" className="capitalize">{enrichedData.seniority}</Badge>
                : <span className="text-[12px] text-text-tertiary">—</span>}
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary mb-2">Departments</div>
              {enrichedData?.departments && enrichedData.departments.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {enrichedData.departments.map((d, i) => (
                    <Badge key={i} tone={i % 2 === 0 ? 'blue' : 'purple'} size="sm" className="capitalize">{d}</Badge>
                  ))}
                </div>
              ) : <span className="text-[12px] text-text-tertiary">—</span>}
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-text-tertiary mb-2">Email status</div>
              {enrichedData?.email_status
                ? <Badge tone={enrichedData.email_status === 'verified' ? 'green' : 'neutral'} size="sm" dot>{enrichedData.email_status}</Badge>
                : <span className="text-[12px] text-text-tertiary">—</span>}
            </div>
          </div>
        </CardShell>
      )}

      {/* Why Gio thinks this is a fit */}
      <CardShell title="Why Gio thinks this is a fit" caption="From employment history" icon={Sparkles}>
        <div className="divide-y divide-border/60">
          <MatchRow
            icon={Briefcase}
            label="Role"
            value={
              <>
                {enrichedData?.role_current || apolloData?.current_role || 'Unknown role'}
                {(enrichedData?.company_current || apolloData?.current_company) && (
                  <> at <span className="text-text-primary">{enrichedData?.company_current || apolloData?.current_company}</span></>
                )}
              </>
            }
            kind={roleMatchKind}
          />
          {keywordMatches.total > 0 && (
            <MatchRow
              icon={Check}
              label="Keywords"
              value={
                <>
                  Matches <span className="text-text-primary">{keywordMatches.matched} of {keywordMatches.total}</span> search keywords
                </>
              }
              kind={keywordMatches.matched === keywordMatches.total ? 'match' : keywordMatches.matched > 0 ? 'partial' : 'miss'}
            />
          )}
        </div>
      </CardShell>

      {/* Matched keywords */}
      {keywordMatches.total > 0 && (
        <CardShell title="Matched keywords" caption="Computed locally">
          <div className="flex flex-wrap gap-1.5">
            {keywordMatches.items.map((kw, i) => (
              <KeywordBadge key={i} label={kw.label} matched={kw.matched} />
            ))}
          </div>
          <p className="text-[11.5px] text-text-tertiary italic mt-3">
            Computed locally against the headline, title and employment-history descriptions.
          </p>
        </CardShell>
      )}

      {/* Employment history */}
      {enrichedData?.employment_history && enrichedData.employment_history.length > 0 && (
        <CardShell
          title="Employment history"
          caption={`${enrichedData.employment_history.length} role${enrichedData.employment_history.length === 1 ? '' : 's'} · employment_history[]`}
        >
          <div className="relative">
            {enrichedData.employment_history.map((exp, i, arr) => {
              const initial = (exp.company?.[0] || '?').toUpperCase()
              const startLabel = formatMonthYear(exp.start_date) || '—'
              const endLabel = exp.is_current ? 'Present' : (formatMonthYear(exp.end_date) || 'Present')
              return (
                <div key={i} className="flex gap-3 relative">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="h-8 w-8 rounded-md bg-virgilio-purple/10 text-virgilio-purple flex items-center justify-center font-poppins font-semibold text-[12px]">
                      {initial}
                    </div>
                    {i < arr.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-poppins font-semibold text-text-primary">{exp.title || '—'}</span>
                      {exp.is_current && <Badge tone="green" size="xs" dot>Current</Badge>}
                    </div>
                    <div className="text-[12.5px] text-text-secondary mt-0.5">{exp.company}</div>
                    <div className="text-[11.5px] text-text-tertiary mt-0.5">{startLabel} – {endLabel}</div>
                    {exp.description && (
                      <p className="text-[12.5px] text-text-secondary leading-relaxed mt-2">{exp.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardShell>
      )}

      {/* Dashed info note */}
      <div className="rounded-lg border border-dashed border-border bg-surface-primary/40 px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-text-tertiary mt-0.5 flex-shrink-0" />
        <p className="text-[12.5px] text-text-secondary leading-relaxed">
          <span className="font-medium text-text-primary">Education, resume, GitHub, Twitter and headshot</span> aren't part of Apollo's enrichment response. They show up once a candidate applies or you upload a resume to their profile.
        </p>
      </div>
    </div>
  )

  const PostCollectFooter = (
    <div className="border-t border-virgilio-border bg-[#F6F5F1]/95 backdrop-blur px-6 sm:px-10 py-4 flex items-center justify-between gap-4 flex-shrink-0">
      <p className="text-[12px] text-text-tertiary">
        Collected by you
        {collectedAgo && <> · {collectedAgo}</>}
        {apolloRefreshedAgo && <> · Apollo refreshed {apolloRefreshedAgo}</>}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={Bookmark} onClick={handleShortlist} type="button">
          Save to talent pool
        </Button>
        <Button
          variant="secondary"
          icon={Mail}
          type="button"
          onClick={() => {
            if (enrichedData?.candidate_id) {
              navigate(`/candidates?openCandidate=${enrichedData.candidate_id}&action=email`)
            }
          }}
        >
          Reach out
        </Button>
        <Button
          icon={UserPlus}
          type="button"
          onClick={() => setShowJobSelection(true)}
        >
          Add to job
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[96vw] sm:max-w-4xl h-full p-0" showOverlay={false}>
          <div className="flex h-full flex-col">
            {TopBar}
            {IdentityBlock}
            {isCollected ? PostCollectBody : PreCollectBody}
            {isCollected ? PostCollectFooter : PreCollectFooter}
          </div>
        </SheetContent>
      </Sheet>


      <JobSelectionDialog
        open={showJobSelection}
        onOpenChange={setShowJobSelection}
        onJobSelected={handleJobSelected}
        onSkip={() => { setShowJobSelection(false); handleCollectProfile() }}
        initialJobId={jobId}
      />
    </>
  )
}
