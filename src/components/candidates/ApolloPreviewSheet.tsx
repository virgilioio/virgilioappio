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
  GraduationCap, Copy, Sparkles, Linkedin,
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
    candidate_name: string
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
          {Icon && <Icon className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={2.2} />}
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

function MatchChip({ kind }: { kind: 'match' | 'partial' | 'inferred' | 'miss' }) {
  const config = {
    match:    { label: 'Match',    cls: 'bg-green-50 text-green-700 border-green-200' },
    partial:  { label: 'Partial',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    inferred: { label: 'Inferred', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    miss:     { label: 'No match', cls: 'bg-surface-secondary text-text-tertiary border-border' },
  }[kind]
  return (
    <span className={cn(
      "inline-flex items-center px-2 h-[22px] rounded-md border text-[11px] font-medium font-poppins",
      config.cls
    )}>
      {config.label}
    </span>
  )
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
  kind: 'match' | 'partial' | 'inferred' | 'miss'
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <Icon className="h-3.5 w-3.5 text-text-tertiary mt-0.5 flex-shrink-0" strokeWidth={2} />
        <div className="min-w-0">
          <div className="text-[11px] text-text-tertiary uppercase tracking-[0.06em] font-medium">{label}</div>
          <div className="text-[13px] text-text-primary mt-0.5 leading-snug">{value}</div>
        </div>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <MatchChip kind={kind} />
      </div>
    </div>
  )
}

function KeywordChip({ label, matched }: { label: string; matched: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 h-[26px] rounded-full text-[12px] font-poppins font-medium border",
      matched
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-transparent text-text-tertiary border-border"
    )}>
      {matched && <Check className="h-3 w-3" strokeWidth={2.5} />}
      {label}
    </span>
  )
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
        <div className="h-7 w-7 rounded-md bg-surface-secondary flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-poppins font-medium text-text-primary truncate leading-tight">{label}</div>
          {sublabel && (
            <div className="text-[10.5px] text-text-tertiary truncate mt-0.5">{sublabel}</div>
          )}
        </div>
      </div>
      <span className={cn(
        "inline-flex items-center gap-1 px-1.5 h-[20px] rounded text-[10.5px] font-medium font-poppins flex-shrink-0",
        available
          ? "bg-green-50 text-green-700"
          : "bg-surface-secondary text-text-tertiary"
      )}>
        {available && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        {available ? 'Available' : 'Not in record'}
      </span>
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

function daysAgoLabel(iso?: string): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  const days = Math.max(1, Math.round(ms / 86_400_000))
  return `${days}d ago`
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
    return calculateFitScore(apolloData, searchCriteria)
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
        const { data: candidateData } = await supabase.from('candidates')
          .select('id, candidate_name, linkedin_url, email, phone, location_city, location_state, location_country, skills, profile_summary')
          .eq('id', candidateId).single()
        if (candidateData) {
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
  const isCollected = !!enrichedData
  const rawName = enrichedData?.candidate_name || apolloData?.candidate_name || 'Unknown Candidate'
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
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onOpenChange(false)} aria-label="Close">
          <X className="h-4 w-4" />
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
        {(apolloData?.current_role || apolloData?.current_company) && (
          <p className="text-[14px] text-text-secondary mt-1">
            {apolloData?.current_role}
            {apolloData?.current_company && (
              <> at <span className="text-text-primary font-medium">{apolloData.current_company}</span></>
            )}
          </p>
        )}
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
      </div>
      {!isCollected && keywordMatches.total > 0 && (
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
                <KeywordChip key={i} label={kw.label} matched={kw.matched} />
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
    <div className="border-t border-border bg-surface-primary px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-md bg-virgilio-purple/10 flex items-center justify-center flex-shrink-0">
          <Lock className="h-3.5 w-3.5 text-virgilio-purple" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-poppins font-medium text-text-primary leading-tight">
            Collect to reveal the {collectableCount} fields above.
          </div>
          <div className="text-[11.5px] text-text-tertiary mt-0.5">
            Uses <span className="font-medium text-text-secondary">1 credit</span>
            {remainingCredits !== null && (
              <> · {remainingCredits} remaining this month</>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={handleNavigateNext} disabled={!hasNext}>
          Skip
        </Button>
        <Button
          variant="purple"
          size="sm"
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

  const PostCollectBody = (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-green-800">Profile Collected</h4>
                <p className="text-sm text-green-600">Full details now available</p>
              </div>
            </div>
            <Button
              onClick={() => {
                if (collectedJobId && enrichedData?.candidate_id) {
                  navigate(`/jobs/${collectedJobId}?candidate=${enrichedData.candidate_id}`)
                } else if (enrichedData?.candidate_id) {
                  navigate(`/candidates?openCandidate=${enrichedData.candidate_id}`)
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {collectedJobId ? 'View in Pipeline' : 'View Profile'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={['contact', 'experience', 'skills']} className="space-y-3">
        <AccordionItem value="contact" className="border rounded-lg bg-surface-primary">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-text-secondary" />
              <span className="font-medium">Contact Information</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="px-4 pb-4 space-y-3">
              {enrichedData?.email && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Mail className="h-4 w-4 text-text-secondary flex-shrink-0" />
                    <a href={`mailto:${enrichedData.email}`} className="text-sm text-blue-600 hover:underline truncate">
                      {enrichedData.email}
                    </a>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                      Verified
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(enrichedData.email!)
                      toast({ title: 'Copied', description: 'Email copied to clipboard' })
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-text-secondary" />
                {enrichedData?.phone ? (
                  <a href={`tel:${enrichedData.phone}`} className="text-sm text-blue-600 hover:underline">
                    {enrichedData.phone}
                  </a>
                ) : phoneCheckStatus === 'checking' ? (
                  <span className="text-sm text-amber-600 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                    Checking for phone...
                  </span>
                ) : apolloData?.has_phone ? (
                  <span className="text-sm text-text-tertiary">Phone pending - try refreshing</span>
                ) : (
                  <span className="text-sm text-text-tertiary">Phone not available</span>
                )}
              </div>
              {enrichedData?.linkedin_url && (
                <div className="flex items-center gap-2">
                  <LinkedInFilled className="h-4 w-4 text-text-secondary" />
                  <a href={enrichedData.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">
                    {enrichedData.linkedin_url}
                  </a>
                </div>
              )}
              {enrichedLocation && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-text-secondary" />
                  <span className="text-sm text-text-primary">{enrichedLocation}</span>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="experience" className="border rounded-lg bg-surface-primary">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-text-secondary" />
              <span className="font-medium">Work Experience</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="px-4 pb-4">
              <p className="text-sm text-text-secondary text-center">
                View complete work history on the full profile page
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="skills" className="border rounded-lg bg-surface-primary">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-text-secondary" />
              <span className="font-medium">Skills</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="px-4 pb-4">
              {enrichedData?.skills && enrichedData.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {enrichedData.skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">No skills extracted</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="education" className="border rounded-lg bg-surface-primary">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-text-secondary" />
              <span className="font-medium">Education</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="px-4 pb-4">
              <p className="text-sm text-text-secondary text-center">
                View education details on the full profile page
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[96vw] sm:max-w-2xl h-full p-0" showOverlay={false}>
          <div className="flex h-full flex-col">
            {TopBar}
            {IdentityBlock}
            {isCollected ? PostCollectBody : PreCollectBody}
            {!isCollected && PreCollectFooter}
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
