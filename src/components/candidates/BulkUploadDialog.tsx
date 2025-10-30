import { useState, useEffect } from 'react'
import { Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { BulkUploadDropzone } from './BulkUploadDropzone'
import { BulkUploadProgressList } from './BulkUploadProgressList'
import { BulkUploadSummary } from './BulkUploadSummary'
import { useBulkCandidateUpload } from '@/hooks/useBulkCandidateUpload'
import { useJobs } from '@/hooks/useJobs'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'

interface BulkUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

type Step = 'upload' | 'processing' | 'summary'

export function BulkUploadDialog({
  isOpen,
  onClose,
  onComplete
}: BulkUploadDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [autoGenerateSkills, setAutoGenerateSkills] = useState(false)
  const [assignToJob, setAssignToJob] = useState<string>()
  const [assignToStage, setAssignToStage] = useState<string>()

  const { uploadCandidates, isProcessing, fileResults, progress } = useBulkCandidateUpload()
  const { jobs } = useJobs()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const [stageOptions, setStageOptions] = useState<Array<{ id: string; name: string }>>([])

  const activeJobs = jobs?.filter(j => j.status !== 'archived') || []
  
  useEffect(() => {
    if (assignToJob) {
      loadHiringPlanInstances(assignToJob).then(stages => {
        setStageOptions(stages.map(s => ({ 
          id: s.jhsId, 
          name: s.customStageName || s.stage.stage_name 
        })))
      })
    } else {
      setStageOptions([])
    }
  }, [assignToJob, loadHiringPlanInstances])

  // Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('upload')
      setFiles([])
      setAutoGenerateSkills(false)
      setAssignToJob(undefined)
      setAssignToStage(undefined)
    }
  }, [isOpen])

  // Auto-advance to summary when processing completes
  useEffect(() => {
    if (step === 'processing' && !isProcessing && fileResults.length > 0) {
      const allCompleted = fileResults.every(
        r => r.status === 'success' || r.status === 'duplicate' || r.status === 'error'
      )
      if (allCompleted) {
        setStep('summary')
      }
    }
  }, [step, isProcessing, fileResults])

  const handleStartUpload = async () => {
    if (files.length === 0) return

    setStep('processing')
    await uploadCandidates(files, {
      autoGenerateSkills,
      assignToJob,
      assignToStage
    })
  }

  const handleComplete = () => {
    onComplete?.()
    onClose()
  }

  const handleClose = () => {
    if (isProcessing) {
      if (!confirm('Upload in progress. Are you sure you want to cancel?')) {
        return
      }
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-h3-mobile md:text-h3-desktop font-poppins font-bold">
            <Upload className="text-virgilio-purple h-6 w-6" />
            Bulk Upload Candidates<span className="text-virgilio-purple">.</span>
          </DialogTitle>
          <DialogDescription className="text-virgilio-muted">
            {step === 'upload' && 'Upload multiple resumes at once and we\'ll automatically parse them'}
            {step === 'processing' && 'Processing your resumes...'}
            {step === 'summary' && 'Upload complete! Review the results below'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-180px)]">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <BulkUploadDropzone
                files={files}
                onFilesSelected={setFiles}
              />

              {/* Options */}
              <div className="space-y-4 p-4 border rounded-lg bg-card">
                <h4 className="font-semibold text-virgilio-text">⚙️ Options</h4>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-skills" className="cursor-pointer">
                    Auto-generate skills from resume
                  </Label>
                  <Switch
                    id="auto-skills"
                    checked={autoGenerateSkills}
                    onCheckedChange={setAutoGenerateSkills}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assign all candidates to job (optional)</Label>
                  <Select value={assignToJob} onValueChange={setAssignToJob}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeJobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {assignToJob && (
                  <div className="space-y-2">
                    <Label>Select pipeline stage</Label>
                    <Select value={assignToStage} onValueChange={setAssignToStage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stageOptions.map(stage => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Progress: {fileResults.filter(r => 
                      r.status === 'success' || r.status === 'duplicate' || r.status === 'error'
                    ).length}/{fileResults.length}
                  </span>
                  <span className="font-medium text-virgilio-text">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <BulkUploadProgressList
                fileResults={fileResults}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* Step 3: Summary */}
          {step === 'summary' && (
            <BulkUploadSummary
              results={fileResults}
              onClose={onClose}
              onViewCandidates={handleComplete}
            />
          )}
        </div>

        {/* Footer */}
        {step === 'upload' && (
          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleStartUpload}
              disabled={files.length === 0}
              className="bg-virgilio-purple hover:bg-virgilio-purple/90 shadow-calendly"
            >
              Start Upload ({files.length})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
