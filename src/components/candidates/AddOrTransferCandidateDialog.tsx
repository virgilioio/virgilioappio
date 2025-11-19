import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select'
import { AlertCircle, Plus, ArrowRightLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useJobs } from '@/hooks/useJobs'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useCandidateTransfer } from '@/hooks/useCandidateTransfer'
import type { JobStage } from '@/hooks/useJobStages'

interface AddOrTransferCandidateDialogProps {
  candidateId: string
  candidateName: string
  currentJobId: string
  currentJobTitle: string
  trigger?: React.ReactNode
}

export function AddOrTransferCandidateDialog({
  candidateId,
  candidateName,
  currentJobId,
  currentJobTitle,
  trigger
}: AddOrTransferCandidateDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'add' | 'transfer'>('add')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [stages, setStages] = useState<JobStage[]>([])
  const [stagesLoading, setStagesLoading] = useState(false)

  const { jobs, isLoading: jobsLoading } = useJobs()
  const { loadHiringPlan } = useJobHiringPlan()
  const { addToJob, transferCandidate, isTransferring } = useCandidateTransfer()

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedJobId('')
      setSelectedStageId('')
      setActiveTab('add')
    }
  }, [open])

  // Load stages when job changes
  useEffect(() => {
    if (selectedJobId) {
      setStagesLoading(true)
      loadHiringPlan(selectedJobId).then(loadedStages => {
        setStages(loadedStages)
        if (loadedStages.length > 0) {
          setSelectedStageId(loadedStages[0].id)
        }
        setStagesLoading(false)
      })
    } else {
      setStages([])
      setSelectedStageId('')
    }
  }, [selectedJobId, loadHiringPlan])

  // Filter out current job and archived jobs
  const availableJobs = jobs?.filter(
    job => job.id !== currentJobId && job.status !== 'archived'
  ) || []

  // Transform jobs into searchable select options
  const jobOptions: SearchableSelectOption[] = availableJobs.map(job => ({
    value: job.id,
    label: job.title
  }))

  const handleAdd = async () => {
    if (!selectedJobId || !selectedStageId) return

    const targetJob = availableJobs.find(j => j.id === selectedJobId)
    
    const result = await addToJob({
      candidateId,
      candidateName,
      targetJobId: selectedJobId,
      targetJobTitle: targetJob?.title || '',
      targetStageId: selectedStageId
    })

    if (result.success) {
      setOpen(false)
    }
  }

  const handleTransfer = async () => {
    if (!selectedJobId || !selectedStageId) return

    const targetJob = availableJobs.find(j => j.id === selectedJobId)

    const result = await transferCandidate({
      candidateId,
      candidateName,
      sourceJobId: currentJobId,
      sourceJobTitle: currentJobTitle,
      targetJobId: selectedJobId,
      targetJobTitle: targetJob?.title || '',
      targetStageId: selectedStageId
    })

    if (result.success) {
      setOpen(false)
      // Close the candidate profile sheet as well since candidate is no longer in this job
      window.history.back()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Add / Transfer to Job
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add or Transfer Candidate</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'add' | 'transfer')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="add">
              <Plus className="h-4 w-4 mr-2" />
              Add to Job
            </TabsTrigger>
            <TabsTrigger value="transfer">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transfer to Job
            </TabsTrigger>
          </TabsList>

          {/* ADD TAB */}
          <TabsContent value="add" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Add to Job:</strong> Creates a new association for this candidate in another job. 
                The candidate will remain in <strong>{currentJobTitle}</strong>. 
                Job-specific data (comments, emails, scorecards) will NOT be copied.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Target Job</label>
                <SearchableSelect
                  options={jobOptions}
                  value={selectedJobId}
                  onValueChange={setSelectedJobId}
                  placeholder="Search or select a job..."
                  searchPlaceholder="Search jobs..."
                  emptyMessage="No jobs found."
                  className="w-full"
                  disabled={jobsLoading}
                />
              </div>

              {selectedJobId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Pipeline Stage</label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={stagesLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stages?.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAdd}
                disabled={!selectedJobId || !selectedStageId || isTransferring}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Job
              </Button>
            </div>
          </TabsContent>

          {/* TRANSFER TAB */}
          <TabsContent value="transfer" className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Transfer to Job:</strong> Moves this candidate entirely to another job. 
                All job-specific data (comments, emails, scorecards, activity history) will be transferred. 
                The candidate will be <strong>removed from {currentJobTitle}</strong>. 
                <strong className="block mt-2">This action cannot be undone.</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Target Job</label>
                <SearchableSelect
                  options={jobOptions}
                  value={selectedJobId}
                  onValueChange={setSelectedJobId}
                  placeholder="Search or select a job..."
                  searchPlaceholder="Search jobs..."
                  emptyMessage="No jobs found."
                  className="w-full"
                  disabled={jobsLoading}
                />
              </div>

              {selectedJobId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Pipeline Stage</label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={stagesLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stages?.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleTransfer}
                disabled={!selectedJobId || !selectedStageId || isTransferring}
              >
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer Candidate
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
