import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface JobCandidateLike {
  id: string
  candidate_name: string
  location_country: string | null
  location_state: string | null
  location_city: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  profile_summary: string | null
  linkedin_url: string | null
  skills: string[] | null
}

interface BulkMoveJobCandidatesToPipelineDialogProps {
  jobId: string
  candidates: JobCandidateLike[]
  disabled?: boolean
  onCompleted?: () => void
}

export default function BulkMoveJobCandidatesToPipelineDialog({ jobId, candidates, disabled, onCompleted }: BulkMoveJobCandidatesToPipelineDialogProps) {
  const [open, setOpen] = useState(false)
  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: { stage_name: string }; position: number }[]>([])
  const [selectedJhsId, setSelectedJhsId] = useState<string | undefined>(undefined)
  const [loadingStages, setLoadingStages] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()

  useEffect(() => {
    const load = async () => {
      if (!open) return
      setLoadingStages(true)
      try {
        const options = await loadHiringPlanInstances(jobId)
        setStageOptions(options || [])
        setSelectedJhsId(options?.[0]?.jhsId)
      } finally {
        setLoadingStages(false)
      }
    }
    load()
  }, [open, jobId, loadHiringPlanInstances])

  const ensureIndependentCandidateId = async (jobCandidate: JobCandidateLike): Promise<string> => {
    // 1) By LinkedIn
    if (jobCandidate.linkedin_url) {
      const { data: existingByLinkedin } = await supabase
        .from('candidates')
        .select('id')
        .eq('linkedin_url', jobCandidate.linkedin_url)
        .maybeSingle()
      if (existingByLinkedin?.id) return existingByLinkedin.id
    }
    // 2) By name
    const { data: existingByName } = await supabase
      .from('candidates')
      .select('id')
      .eq('candidate_name', jobCandidate.candidate_name)
      .maybeSingle()
    if (existingByName?.id) return existingByName.id

    // 3) Create
    const { data: authData } = await supabase.auth.getUser()
    const createdBy = authData.user?.id ?? null
    const insertPayload: any = {
      candidate_name: jobCandidate.candidate_name,
      location_country: jobCandidate.location_country,
      location_state: jobCandidate.location_state,
      location_city: jobCandidate.location_city,
      salary_amount: jobCandidate.salary_amount,
      salary_currency: jobCandidate.salary_currency,
      salary_period: jobCandidate.salary_period,
      profile_summary: jobCandidate.profile_summary,
      linkedin_url: jobCandidate.linkedin_url,
      skills: jobCandidate.skills,
      status: 'available',
      source: 'job_application',
      created_by: createdBy,
    }
    const { data: created, error } = await supabase
      .from('candidates')
      .insert([insertPayload])
      .select('id')
      .single()
    if (error || !created?.id) throw error || new Error('Failed to create independent candidate')
    return created.id
  }

  const onConfirm = async () => {
    if (!selectedJhsId || candidates.length === 0) return
    setSubmitting(true)
    try {
      const results = await Promise.allSettled(
        candidates.map(async (c) => {
          const indId = await ensureIndependentCandidateId(c)
          return createAssociationAndMove(jobId, indId, selectedJhsId)
        })
      )
      const successes = results.filter(r => r.status === 'fulfilled').length
      const failures = results.length - successes
      if (successes) toast({ title: 'Moved to pipeline', description: `${successes} candidate(s) moved.` })
      if (failures) toast({ title: 'Some failed', description: `${failures} candidate(s) failed.`, variant: 'destructive' })
      setOpen(false)
      onCompleted?.()
    } catch (e) {
      toast({ title: 'Error', description: 'Could not move candidates.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={disabled || candidates.length === 0}>Move to pipeline</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {candidates.length} candidate(s) to pipeline</DialogTitle>
          <DialogDescription>Select a stage in this job's pipeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Stage</label>
            <Select value={selectedJhsId} onValueChange={setSelectedJhsId} disabled={loadingStages || stageOptions.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={loadingStages ? 'Loading stages…' : (stageOptions.length ? 'Select a stage' : 'No stages configured')} />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map(opt => (
                  <SelectItem key={opt.jhsId} value={opt.jhsId}>{opt.stage.stage_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={onConfirm} disabled={!selectedJhsId || submitting}>Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
