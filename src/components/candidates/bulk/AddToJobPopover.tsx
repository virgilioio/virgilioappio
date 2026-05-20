import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, ChevronRight, ArrowLeft, Briefcase, CheckCircle2, AlertCircle, Loader2, Users } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useJobs, type Job } from '@/hooks/useJobs'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'

const RECENT_KEY = 'recent-add-to-job-jobs'
const RECENT_MAX = 3

type Stage = { jhsId: string; stage: { id: string; stage_name: string }; position: number; customStageName?: string | null }
type DuplicateRow = { candidateId: string; associationId: string; currentStageId: string | null; currentStageName: string }
type DupAction = 'skip' | 'move'

interface AddToJobPopoverProps {
  candidateIds: string[]
  candidateNames?: string[]
  trigger: ReactNode
  onCompleted?: () => void
}

function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch { return [] }
}
function pushRecentId(id: string) {
  try {
    const arr = [id, ...readRecentIds().filter(x => x !== id)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr))
  } catch { /* ignore */ }
}

function stageLabel(s: Stage) {
  return s.customStageName?.trim() || s.stage.stage_name
}

export function AddToJobPopover({ candidateIds, candidateNames, trigger, onCompleted }: AddToJobPopoverProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateRow[]>([])
  const [dupActions, setDupActions] = useState<Record<string, DupAction>>({})
  const [loadingStages, setLoadingStages] = useState(false)
  const [loadingDup, setLoadingDup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const recentIdsRef = useRef<string[]>([])

  const { jobs, isLoading: jobsLoading, getJobs } = useJobs()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()

  // Reset when opened.
  useEffect(() => {
    if (open) {
      setStep(1); setSearch(''); setSelectedJob(null); setStages([])
      setStageCounts({}); setSelectedStage(null); setDuplicates([]); setDupActions({})
      recentIdsRef.current = readRecentIds()
      getJobs()
    }
  }, [open, getJobs])

  const openJobs = useMemo(() => jobs.filter(j => j.status === 'open'), [jobs])
  const recentJobs = useMemo(() => {
    const map = new Map(openJobs.map(j => [j.id, j]))
    return recentIdsRef.current.map(id => map.get(id)).filter(Boolean) as Job[]
  }, [openJobs])
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = openJobs
    if (!q) return base
    return base.filter(j =>
      j.title?.toLowerCase().includes(q) ||
      (j as any).organization_name?.toLowerCase().includes(q)
    )
  }, [openJobs, search])

  const pickJob = async (job: Job) => {
    setSelectedJob(job)
    setStep(2)
    setLoadingStages(true)
    try {
      const [planRes, countsRes] = await Promise.all([
        loadHiringPlanInstances(job.id),
        supabase.from('job_candidate_associations')
          .select('current_stage_id')
          .eq('job_id', job.id)
          .neq('status', 'rejected'),
      ])
      const plan = (planRes || []) as Stage[]
      setStages(plan)
      const counts: Record<string, number> = {}
      ;(countsRes.data || []).forEach((row: any) => {
        const id = row.current_stage_id as string | null
        if (!id) return
        counts[id] = (counts[id] || 0) + 1
      })
      setStageCounts(counts)
    } finally {
      setLoadingStages(false)
    }
  }

  const pickStage = async (stage: Stage) => {
    if (!selectedJob) return
    setSelectedStage(stage)
    setLoadingDup(true)
    try {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('id, candidate_id, current_stage_id')
        .eq('job_id', selectedJob.id)
        .in('candidate_id', candidateIds)
      if (error) throw error
      const stageNameById = new Map<string, string>()
      stages.forEach(s => stageNameById.set(s.jhsId, stageLabel(s)))
      const dups: DuplicateRow[] = (data || []).map(row => ({
        candidateId: row.candidate_id,
        associationId: row.id,
        currentStageId: row.current_stage_id,
        currentStageName: row.current_stage_id ? (stageNameById.get(row.current_stage_id) || '—') : '—',
      }))
      setDuplicates(dups)
      const init: Record<string, DupAction> = {}
      dups.forEach(d => { init[d.candidateId] = 'skip' })
      setDupActions(init)
      setStep(dups.length > 0 ? 3 : 4)
    } catch (e) {
      toast({ title: 'Error', description: 'Could not check existing associations.', variant: 'destructive' })
    } finally {
      setLoadingDup(false)
    }
  }

  const namesById = useMemo(() => {
    const m = new Map<string, string>()
    candidateIds.forEach((id, i) => m.set(id, candidateNames?.[i] || 'Candidate'))
    return m
  }, [candidateIds, candidateNames])

  const counts = useMemo(() => {
    const dupIds = new Set(duplicates.map(d => d.candidateId))
    const toAdd = candidateIds.filter(id => !dupIds.has(id)).length
    const toMove = duplicates.filter(d => dupActions[d.candidateId] === 'move' && d.currentStageId !== selectedStage?.jhsId).length
    const skip = duplicates.length - duplicates.filter(d => dupActions[d.candidateId] === 'move').length
      + duplicates.filter(d => dupActions[d.candidateId] === 'move' && d.currentStageId === selectedStage?.jhsId).length
    return { toAdd, toMove, skip }
  }, [candidateIds, duplicates, dupActions, selectedStage])

  const submit = async () => {
    if (!selectedJob || !selectedStage) return
    setSubmitting(true)
    const dupIds = new Set(duplicates.map(d => d.candidateId))
    const targets: string[] = []
    candidateIds.forEach(id => {
      if (!dupIds.has(id)) { targets.push(id); return }
      if (dupActions[id] === 'move') targets.push(id)
    })
    try {
      const results = await Promise.allSettled(
        targets.map(id => createAssociationAndMove(selectedJob.id, id, selectedStage.jhsId))
      )
      const ok = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - ok
      pushRecentId(selectedJob.id)
      if (ok) {
        toast({
          title: 'Added to pipeline',
          description: `${ok} candidate${ok === 1 ? '' : 's'} added to ${selectedJob.title} · ${stageLabel(selectedStage)}.`,
        })
      }
      if (failed) {
        toast({ title: 'Some failed', description: `${failed} could not be added.`, variant: 'destructive' })
      }
      setOpen(false)
      onCompleted?.()
    } finally {
      setSubmitting(false)
    }
  }

  const headerTitle = `Add ${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'} to a job`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[520px] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s === 4 && duplicates.length === 0 ? 2 : (s - 1) as 1 | 2 | 3 | 4))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-[#F1F0EC]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-poppins font-semibold text-[13.5px] tracking-[-0.01em] truncate">
              {step === 1 && headerTitle}
              {step === 2 && (selectedJob?.title || 'Pick stage')}
              {step === 3 && 'Resolve duplicates'}
              {step === 4 && 'Confirm'}
            </div>
            {step >= 2 && selectedJob && step !== 1 && (
              <div className="text-[11.5px] text-muted-foreground truncate font-inter">
                {step === 2 ? `${candidateIds.length} candidate${candidateIds.length === 1 ? '' : 's'}` : selectedJob.title}
              </div>
            )}
          </div>
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-inter">Step {step}/4</div>
        </div>

        {/* Body */}
        <div className="max-h-[480px] overflow-y-auto">
          {step === 1 && (
            <div className="p-2">
              <div className="relative px-2 pt-1 pb-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search open jobs…"
                  className="h-8 pl-7 text-[12.5px]"
                  autoFocus
                />
              </div>
              {jobsLoading ? (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading jobs…
                </div>
              ) : (
                <>
                  {!search && recentJobs.length > 0 && (
                    <div className="mb-1">
                      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-[0.08em] text-[#8B8F9E] font-inter">Recently used</div>
                      {recentJobs.map(j => (
                        <JobRow key={`r-${j.id}`} job={j} onClick={() => pickJob(j)} />
                      ))}
                    </div>
                  )}
                  <div>
                    <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-[0.08em] text-[#8B8F9E] font-inter">
                      {search ? 'Results' : 'Open jobs'}
                    </div>
                    {filteredJobs.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">No matching jobs.</div>
                    ) : (
                      filteredJobs.map(j => <JobRow key={j.id} job={j} onClick={() => pickJob(j)} />)
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="p-3">
              {loadingStages ? (
                <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading pipeline…
                </div>
              ) : stages.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">No stages defined for this job.</div>
              ) : (
                <ul className="space-y-1">
                  {stages.map((s, idx) => (
                    <li key={s.jhsId}>
                      <button
                        onClick={() => pickStage(s)}
                        disabled={loadingDup}
                        className="group w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#F1F0EC] transition-colors text-left disabled:opacity-50"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-virgilio-purple/10 text-virgilio-purple text-[11px] font-poppins font-semibold tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-[13px] font-poppins font-medium truncate">{stageLabel(s)}</span>
                        <Badge tone="neutral" size="xs">{stageCounts[s.jhsId] ?? 0}</Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 3 && selectedStage && (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <div className="flex items-center gap-2 text-[12px] text-amber-900">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span><strong>{duplicates.length}</strong> of {candidateIds.length} already in this pipeline</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDupActions(Object.fromEntries(duplicates.map(d => [d.candidateId, 'skip'])))}
                    className="text-[11.5px] px-2 py-1 rounded hover:bg-amber-100 text-amber-900"
                  >Skip all</button>
                  <button
                    onClick={() => setDupActions(Object.fromEntries(duplicates.map(d => [d.candidateId, 'move'])))}
                    className="text-[11.5px] px-2 py-1 rounded hover:bg-amber-100 text-amber-900"
                  >Move all</button>
                </div>
              </div>

              <ul className="space-y-1">
                {duplicates.map(d => (
                  <li key={d.candidateId} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#FAFAF7]">
                    <div className="h-7 w-7 rounded-full bg-virgilio-purple/10 inline-flex items-center justify-center text-[11px] font-poppins font-semibold text-virgilio-purple">
                      {(namesById.get(d.candidateId) || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-poppins font-medium truncate">{namesById.get(d.candidateId)}</div>
                      <div className="text-[11px] text-muted-foreground truncate">Currently in {d.currentStageName}</div>
                    </div>
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      <button
                        onClick={() => setDupActions(a => ({ ...a, [d.candidateId]: 'skip' }))}
                        className={`px-2.5 py-1 text-[11.5px] font-poppins ${dupActions[d.candidateId] === 'skip' ? 'bg-[#EDE4FF] text-foreground' : 'hover:bg-[#F1F0EC]'}`}
                      >Skip</button>
                      <button
                        onClick={() => setDupActions(a => ({ ...a, [d.candidateId]: 'move' }))}
                        className={`px-2.5 py-1 text-[11.5px] font-poppins border-l border-border ${dupActions[d.candidateId] === 'move' ? 'bg-[#EDE4FF] text-foreground' : 'hover:bg-[#F1F0EC]'}`}
                      >Move here</button>
                    </div>
                  </li>
                ))}
              </ul>

              {counts.toAdd > 0 && (
                <div className="text-[11.5px] text-muted-foreground px-2">
                  + {counts.toAdd} new candidate{counts.toAdd === 1 ? '' : 's'} will be added.
                </div>
              )}
            </div>
          )}

          {step === 4 && selectedJob && selectedStage && (
            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-border bg-[#FAFAF7] p-3">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-inter mb-2">Pipeline preview</div>
                <ul className="space-y-1">
                  {stages.map((s, idx) => {
                    const isTarget = s.jhsId === selectedStage.jhsId
                    const base = stageCounts[s.jhsId] ?? 0
                    const delta = isTarget ? counts.toAdd + counts.toMove : 0
                    return (
                      <li key={s.jhsId} className={`flex items-center gap-3 px-2 py-1.5 rounded-md ${isTarget ? 'bg-virgilio-purple/8' : ''}`}>
                        <span className="text-[11px] tabular-nums text-muted-foreground w-4">{idx + 1}</span>
                        <span className={`flex-1 text-[12.5px] font-poppins truncate ${isTarget ? 'font-semibold' : ''}`}>{stageLabel(s)}</span>
                        <span className="text-[12px] tabular-nums">{base + delta}</span>
                        {delta > 0 && (
                          <span className="text-[11px] tabular-nums text-virgilio-purple font-poppins font-semibold">+{delta}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="flex items-center gap-2 text-[12.5px] font-poppins">
                <CheckCircle2 className="h-4 w-4 text-virgilio-purple" />
                <span><strong>{counts.toAdd}</strong> added · <strong>{counts.toMove}</strong> moved · <strong>{counts.skip}</strong> skipped</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 3 || step === 4) && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-[#FAFAF7]">
            <Button variant="ghost" size="sm" onClick={() => setStep(step === 4 && duplicates.length === 0 ? 2 : (step - 1) as 1 | 2 | 3)}>Back</Button>
            {step === 3 ? (
              <Button size="sm" onClick={() => setStep(4)}>Continue</Button>
            ) : (
              <Button size="sm" onClick={submit} loading={submitting} disabled={counts.toAdd + counts.toMove === 0}>
                Add to pipeline
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function JobRow({ job, onClick }: { job: Job; onClick: () => void }) {
  const org = (job as any).organization_name as string | undefined
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F1F0EC] text-left"
    >
      <span className="h-7 w-7 rounded-md bg-virgilio-purple/10 inline-flex items-center justify-center">
        <Briefcase className="h-3.5 w-3.5 text-virgilio-purple" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-poppins font-medium truncate">{job.title}</span>
        {org && <span className="block text-[11px] text-muted-foreground truncate">{org}</span>}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  )
}
