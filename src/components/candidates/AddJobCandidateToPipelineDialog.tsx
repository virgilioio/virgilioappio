import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import type { Candidate } from '@/hooks/useCandidates'
import type { JobStage } from '@/hooks/useJobStages'

interface AddJobCandidateToPipelineDialogProps {
  jobId: string
  jobCandidate: Candidate
}

export default function AddJobCandidateToPipelineDialog({ jobId, jobCandidate }: AddJobCandidateToPipelineDialogProps) {
  const [open, setOpen] = useState(false)
  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: JobStage; position: number }[]>([])
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

  const ensureIndependentCandidateId = async (): Promise<string> => {
    // 1) Try to find by linkedin_url if available
    if (jobCandidate.linkedin_url) {
      const { data: existingByLinkedin } = await supabase
        .from('candidates')
        .select('id')
        .eq('linkedin_url', jobCandidate.linkedin_url)
        .maybeSingle()
      if (existingByLinkedin?.id) return existingByLinkedin.id
    }

    // 2) Try to find by name (and optional location to be safer)
    const query = supabase.from('candidates').select('id').eq('candidate_name', jobCandidate.candidate_name).maybeSingle()
    const { data: existingByName } = await query
    if (existingByName?.id) return existingByName.id

    // 3) Create a new independent candidate from the job candidate data
    const { data: userData } = await supabase.auth.getUser()
    const createdBy = userData.user?.id ?? null

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

    const { data: created, error: createError } = await supabase
      .from('candidates')
      .insert([insertPayload])
      .select('id')
      .single()

    if (createError || !created?.id) {
      throw createError || new Error('Failed to create independent candidate record.')
    }

    return created.id
  }

  const onConfirm = async () => {
    if (!selectedJhsId) return
    setSubmitting(true)
    try {
      const independentCandidateId = await ensureIndependentCandidateId()
      await createAssociationAndMove(jobId, independentCandidateId, selectedJhsId)
      setOpen(false)
      toast({ title: 'Added to pipeline', description: 'Candidate moved to the selected stage.' })
    } catch (e) {
      // errors are toasted in hook; fall back toast
      toast({ title: 'Error', description: 'Could not move candidate to pipeline.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">Move to pipeline</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to pipeline</DialogTitle>
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
